import { analyzeMaterialsMultimodal } from '$lib/server/analyze-materials-multimodal';
import { crawl, hasAttachmentDisposition } from '$lib/server/crawl';
import { runGenerateObject } from '$lib/server/llm';
import type { ToolHelpers } from '$lib/server/tool-utils/toolHelpers';
import { processYouTubeVideo } from '$lib/server/youtube';
import { getYouTubeChunks, truncateAndGetChunks } from '$lib/utils/chunk';
import type { ExtensionCrawlServer } from '$lib/utils/extension/crawl.server';
import { createScopedLogger } from '$lib/utils/logger.server';
import { isYouTubeVideoUrl } from '$lib/utils/youtube';
import type {
	Annotation,
	BrowseError,
	BrowseSuccess,
	BrowseWebpageArtifact,
	BrowseWebpageResult,
	CrawlResponse,
	UserInfo
} from '@repo/types';
import type { ToolResult, ToolStatus } from '@repo/types/tool-types';
import { createCitation } from '@repo/utils/create-citation';
import { tool, type CoreMessage, type ToolInvocation } from 'ai';
import { type UUID } from 'crypto';
import type { JSONSchema7 } from 'json-schema';
import { extractText } from 'unpdf';
import { z } from 'zod';
import { ProcessAbortError } from '../components/MultiStepProcess';
import { TaskPipeline, TaskRunner } from '../components/TaskRunner';

const logger = createScopedLogger('browse-tool');

export const browse = (userInfo: UserInfo, helpers: ToolHelpers<ExtensionCrawlServer>) =>
	tool({
		description: `This tool fetches one or more URLs and answers the provided question about them (it generates a summary for each URL if no question is provided).

It has all authentication requirements to be used for secure webpages or ones where the user needs to be logged in. It can access private information (like email, social media profiles, other secure apps, etc...) in a safe and secure way. It uses the users credentials and browser and does not expose the information. If the user asks you to get their private information, this tool is completely secure for that purpose.

IMPORTANT: For efficiency, always combine multiple URLs into a single call if you need to browse multiple URLs

## When to Use
- The user asks you to visit one or more webpages and extract information (either text or image or links)
- When you have just done a search and want to look deeper at multiple search results at once (always combine these into one call)
- When you have just done a search and want to look deeper at a specific search result
- When explicitly requested by the user
- When you need to combine/compare information from multiple pages
- When you need to ask a question about a webpage
- When you need to answer a question about a YouTube video link
- When you need to answer a question about an image link

## Best Practices
- Always combine related URLs into a single call rather than making multiple separate calls
- When comparing multiple sites or sources, use a single browse call with all URLs
- Include a specific question for each URL

## When Not to Use
- The user asks you to navigate within a website in a complex way (e.g. fill out a form like "go to Amazon and add a banana to my cart")`,
		parameters: z.object({
			title: z.string().describe('Short title for the call'),
			urls: z
				.array(
					z.object({
						url: z.string(),
						question: z.string().optional().describe('Specific question to answer about this URL')
					})
				)
				.describe('URLs to browse')
		}),
		async execute(args, context) {
			const toolInvocation = {
				toolName: 'browse',
				toolCallId: context.toolCallId,
				args,
				state: 'call' as const
			};
			const state = initState(toolInvocation);
			const results = await runBrowse(state, userInfo, helpers);
			const browseOutput = await createOutputs(state, userInfo, helpers, results);
			const ret = browseOutput.results;
			const annotations = browseOutput.annotations;
			const artifactsCreated: ToolResult['artifactsCreated'] = browseOutput.artifactsCreated;
			return helpers.addToolResult(ret, annotations, artifactsCreated);
		}
	});

export type BrowseState = {
	toolCallId: string;
	toolName: string;
	status: ToolStatus;
	inputs: {
		title: string;
		urls: {
			url: string;
			question?: string;
		}[];
	};
	outputs: {
		message: string;
		results: (
			| {
					question?: string;
					answer: string;
					url: string;
					length: number;
					scrapedAt: string;
					relevantChunks: { citationUUID: UUID; text: string }[];
					links: { link_text: string; url: string }[];
			  }
			| (BrowseError & { url: string })
		)[];
	};
};

function initState(invocation: ToolInvocation) {
	const state: BrowseState = {
		toolCallId: invocation.toolCallId,
		toolName: invocation.toolName,
		status: 'idle',
		inputs: {
			title: invocation.args?.title || '',
			urls: invocation.args?.urls || []
		},
		outputs: {
			message: '',
			results: []
		}
	};
	return state;
}

async function getTextContent(url: string | ArrayBuffer): Promise<string[]> {
	try {
		// Convert input to Uint8Array format expected by unpdf
		let data: Uint8Array;
		if (typeof url === 'string') {
			// For URL strings, we need to fetch the data first
			const response = await fetch(url);
			const arrayBuffer = await response.arrayBuffer();
			data = new Uint8Array(arrayBuffer);
		} else {
			// For ArrayBuffer, convert to Uint8Array
			data = new Uint8Array(url);
		}

		// Use unpdf to extract text with mergePages: false to get per-page text
		const { text: pages } = await extractText(data, { mergePages: false });

		// Format the pages similar to the original implementation
		const textContent = pages.map((pageText, index) => `Page ${index + 1}:\n${pageText}\n`);

		return textContent;
	} catch (err) {
		logger.warn('Error extracting PDF text', err);
		return ['PDF was unreadable'];
	}
}

/**
 * Checks if a URL points to an image based on its extension
 */
function isImageUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(urlObj.pathname);
	} catch {
		return false;
	}
}

/**
 * Checks if a URL points to a PDF based on its extension
 * NOTE: This is a crude check used only for timeout determination before making the HTTP request.
 * The actual PDF detection happens in performBrowseInternal via content-type checking after fetching.
 */
function isPdfUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		return /\.pdf$/i.test(urlObj.pathname);
	} catch {
		return false;
	}
}

/**
 * Extracts the video ID from a YouTube URL
 */
function getYouTubeVideoId(url: string): string | null {
	try {
		const urlObj = new URL(url);
		// Handle standard YouTube URLs (including mobile)
		if (
			(urlObj.hostname === 'www.youtube.com' ||
				urlObj.hostname === 'youtube.com' ||
				urlObj.hostname === 'm.youtube.com') &&
			urlObj.pathname === '/watch'
		) {
			return urlObj.searchParams.get('v');
		}
		// Handle youtu.be short links
		if (urlObj.hostname === 'youtu.be' && urlObj.pathname.length > 1) {
			// The pathname starts with a slash, so we need to remove it
			return urlObj.pathname.substring(1);
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Process an image URL using Gemini's multimodal capabilities
 */
async function processImageUrl(
	url: string,
	question: string | undefined,
	userInfo: UserInfo,
	abortSignal: AbortSignal
): Promise<BrowseSuccess | BrowseError> {
	try {
		// Create a timeout signal for image processing
		const timeoutSignal = createTimeoutSignal(abortSignal, 60000); // 60 second timeout

		// Call the server endpoint to process the image using apiClient
		const result = await analyzeMaterialsMultimodal(
			{
				materialIds: [],
				question: question || 'Describe this image in detail.',
				imageUrl: url,
				modelTier: 'balanced'
			},
			userInfo,
			timeoutSignal
		);

		if (abortSignal.aborted) {
			logger.debug('Image processing aborted');
			return {
				error: 'Image processing aborted'
			};
		}

		// Type guard for error responses
		if (result && typeof result === 'object' && ('error' in result || 'errorMessage' in result)) {
			const errorMsg =
				'error' in result && typeof result.error === 'string'
					? result.error
					: 'errorMessage' in result && typeof result.errorMessage === 'string'
						? result.errorMessage
						: 'Failed to process image';

			// Log the error for debugging
			logger.warn('Image processing returned an error', {
				url,
				question,
				errorMsg,
				result
			});

			return {
				error: errorMsg
			};
		}

		// Create a single chunk with the analysis result
		const content = (result as { answer?: string })?.answer || 'No analysis available';
		const chunk = {
			...createCitation(),
			text: content
		};

		// Use 'webpage' type to match BrowseSuccess interface
		return {
			type: 'webpage',
			chunks: [chunk],
			truncated: false,
			title: 'Image Analysis',
			excerpt: content.substring(0, 150) + (content.length > 150 ? '...' : ''),
			byline: '',
			dir: '',
			siteName: 'Image Analysis',
			lang: 'en',
			publishedTime: ''
		} as BrowseSuccess;
	} catch (error) {
		if ((error as Error).name === 'AbortError' || (error as Error).name === 'ProcessAbortError') {
			logger.debug('Image processing aborted');
			return {
				error: 'Image processing aborted'
			};
		}
		logger.warn('Image processing failed', error);
		return {
			error: (error as Error).message || 'Failed to process image'
		};
	}
}

/**
 * Process a YouTube video using Gemini's multimodal capabilities
 */
async function handleYouTubeVideo(
	url: string,
	question: string | undefined,
	userInfo: UserInfo,
	abortSignal: AbortSignal
): Promise<BrowseSuccess | BrowseError> {
	try {
		const videoId = getYouTubeVideoId(url);
		if (!videoId) {
			return {
				error: 'Invalid YouTube URL'
			};
		}

		// Create a timeout signal for YouTube processing
		const timeoutSignal = createTimeoutSignal(abortSignal, 300000); // 5 minute timeout

		// Call the server endpoint to process the YouTube video
		const result = await processYouTubeVideo(
			{ url, question: question || 'Summarize this video content in detail.' },
			userInfo,
			timeoutSignal
		);

		if (abortSignal.aborted) {
			logger.debug('YouTube video processing aborted');
			return {
				error: 'YouTube video processing aborted'
			};
		}

		// Type guard for error responses
		if (result && typeof result === 'object' && ('error' in result || 'errorMessage' in result)) {
			const errorMsg =
				'error' in result && typeof result.error === 'string'
					? result.error
					: 'errorMessage' in result && typeof result.errorMessage === 'string'
						? result.errorMessage
						: 'Failed to process YouTube video';

			// Log the error for debugging
			logger.warn('YouTube video processing returned an error', {
				url,
				question,
				errorMsg,
				result
			});

			return {
				error: errorMsg
			};
		}

		// Type assertion for successful response
		const videoResult = result as {
			title: string;
			content: string;
			excerpt: string;
			byline: string;
		};

		const chunks = getYouTubeChunks(videoResult.content);

		return {
			type: 'webpage', // Using webpage type for compatibility
			chunks: chunks,
			truncated: false,
			title: videoResult.title || url,
			excerpt: videoResult.excerpt || '',
			byline: videoResult.byline || '',
			dir: '',
			siteName: 'YouTube',
			lang: 'en',
			publishedTime: ''
		} as BrowseSuccess;
	} catch (error) {
		if ((error as Error).name === 'AbortError' || (error as Error).name === 'ProcessAbortError') {
			logger.debug('YouTube video processing aborted');
			return {
				error: 'YouTube video processing aborted'
			};
		}
		logger.warn('YouTube video processing failed', error);
		return {
			error: (error as Error).message || 'Failed to process YouTube video'
		};
	}
}

// Creates an abort signal that combines the original signal with a timeout
function createTimeoutSignal(abortSignal: AbortSignal, timeoutMs: number): AbortSignal {
	return AbortSignal.any([abortSignal, AbortSignal.timeout(timeoutMs)]);
}

export async function performBrowse(
	url: string,
	abortSignal: AbortSignal,
	userInfo: UserInfo,
	extensionCrawl?: ExtensionCrawlServer,
	mode: 'turndown' | 'readability' | 'text' | 'textWithLinks' = 'textWithLinks',
	timeoutMs: number = 60_000
): Promise<BrowseSuccess | BrowseError> {
	try {
		const timeoutSignal = createTimeoutSignal(abortSignal, timeoutMs);
		return await performBrowseInternal(url, timeoutSignal, userInfo, extensionCrawl, mode);
	} catch (error) {
		const isAbortError = error instanceof DOMException && error.name === 'AbortError';
		const isTimeoutError = error instanceof DOMException && error.name === 'TimeoutError';
		if (isTimeoutError) {
			const errorString = `Browse timed out for ${url} after ${timeoutMs}ms`;
			logger.debug(errorString);
			return {
				error: errorString
			};
		}
		if (isAbortError) {
			logger.debug('Browse aborted');
			return {
				error: 'Browse aborted'
			};
		}
		logger.info('Browse request failed', error);
		return {
			error: error instanceof Error ? error.message : 'Failed to browse'
		};
	}
}

function checkIfAborted(abortSignal: AbortSignal) {
	if (abortSignal.aborted) {
		logger.info('Browse aborted');
		throw new DOMException('Browse aborted', 'AbortError');
	}
}

async function performBrowseInternal(
	url: string,
	abortSignal: AbortSignal,
	userInfo: UserInfo,
	extensionCrawl?: ExtensionCrawlServer,
	mode: 'turndown' | 'readability' | 'text' | 'textWithLinks' = 'textWithLinks'
): Promise<BrowseSuccess | BrowseError> {
	try {
		if (extensionCrawl) {
			try {
				const hasAttachment = await hasAttachmentDisposition(url, userInfo.userAgent, abortSignal);
				if (!hasAttachment) {
					const result = await extensionCrawl.crawl(url, mode);
					if (!('error' in result)) {
						return result;
					}
				} else {
					logger.info(
						`Skipping extension crawl for ${url}, Content-Disposition indicates file download`
					);
				}
			} catch (error) {
				logger.info('Error during extension crawl', error);
			}
		}

		// Skipping out on datacenter proxies for now since
		// Vercel Function *are* in a datacenter.
		const proxyTypes: ('datacenter' | 'residential' | undefined)[] = [undefined, 'residential'];
		let crawlResult: CrawlResponse | null = null;

		for (const proxyType of proxyTypes) {
			const readerRespondWith: 'html' | undefined = proxyType ? 'html' : undefined;
			const crawlArgs = {
				url,
				mode,
				userAgent: userInfo.userAgent,
				proxyType,
				readerRespondWith,
				abortSignal
			};
			crawlResult = await crawl(crawlArgs);
			checkIfAborted(abortSignal);

			// TODO: We should only re-attempt in certain cases depending
			// on the status code.
			if (crawlResult) {
				break;
			}
		}

		if (!crawlResult) {
			return {
				error: 'Failed to browse'
			};
		}

		if (crawlResult.source === 'pdf') {
			const arrayBuffer = Buffer.from(crawlResult.base64Data, 'base64').buffer;
			const pdfText = (await getTextContent(arrayBuffer)).join('\n');
			checkIfAborted(abortSignal);
			const { chunks, truncated } = await truncateAndGetChunks(pdfText);
			checkIfAborted(abortSignal);
			return {
				type: 'pdf',
				chunks: chunks,
				truncated: truncated,
				title: url,
				excerpt: '',
				byline: '',
				dir: '',
				siteName: '',
				lang: '',
				publishedTime: ''
			} as BrowseSuccess;
		}

		const { chunks, truncated } = await truncateAndGetChunks(crawlResult.textContent);
		checkIfAborted(abortSignal);

		return {
			type: 'webpage',
			chunks: chunks,
			truncated: truncated,
			title: crawlResult.title,
			excerpt: crawlResult.excerpt,
			byline: crawlResult.byline,
			dir: crawlResult.dir,
			siteName: crawlResult.siteName,
			lang: crawlResult.lang,
			publishedTime: crawlResult.publishedTime
		} as BrowseSuccess;
	} catch (error) {
		const isAbortError = error instanceof DOMException && error.name === 'AbortError';
		const isProcessAbortError = error instanceof ProcessAbortError;
		if (isAbortError || isProcessAbortError) {
			logger.info('Browse aborted');
		} else {
			logger.info('Browse request failed', error);
		}
		throw error;
	}
}

export type CreateBrowsePipelineOptions = {
	artifact: BrowseWebpageArtifact;
	userInfo: UserInfo;
	signal: AbortSignal;
	addToStatus?: (url: string, status: 'Browsing' | 'Watching' | 'Analyzing' | 'Done') => void;
	extensionCrawl?: ExtensionCrawlServer;
	updateArtifact: (artifact: BrowseWebpageArtifact, updateDatabase?: boolean) => Promise<void>;
};

export function createBrowsePipeline(options: CreateBrowsePipelineOptions) {
	const { artifact, userInfo, signal, addToStatus, extensionCrawl, updateArtifact } = options;

	const pipeline = new TaskPipeline<
		{ url: string; question?: string },
		| (BrowseSuccess & {
				generatedTitle: string;
				answer: string;
				url: string;
				question?: string;
				relevantChunkIds: UUID[];
				relevantChunks: { citationUUID: UUID; text: string }[];
		  })
		| (BrowseError & { url: string })
	>(signal);

	// Task 1: Perform the browse operation
	pipeline.addStage(
		new TaskRunner<
			{ url: string; question?: string },
			(BrowseSuccess & { url: string; question?: string }) | (BrowseError & { url: string })
		>(
			6, // Concurrency limit of 6 tabs at a time
			signal,
			async ({ url: inputUrl, question }, abortSignal) => {
				try {
					// Process according to URL type
					if (isYouTubeVideoUrl(inputUrl)) {
						// Set YouTube status
						if (addToStatus) {
							addToStatus(inputUrl, 'Watching');
						}

						// Create a timeout signal for YouTube (5 minutes)
						const timeoutSignal = createTimeoutSignal(abortSignal, 300000);

						const browseResult = await handleYouTubeVideo(
							inputUrl,
							question,
							userInfo,
							timeoutSignal
						);
						if ('error' in browseResult) {
							return { ...browseResult, url: inputUrl };
						}
						return { ...browseResult, url: inputUrl, question };
					} else if (isImageUrl(inputUrl)) {
						// Set image analysis status
						if (addToStatus) {
							addToStatus(inputUrl, 'Analyzing');
						}

						// Create a timeout signal for images (1 minute)
						const timeoutSignal = createTimeoutSignal(abortSignal, 60000);

						// Process image URL using multimodal endpoint
						const browseResult = await processImageUrl(inputUrl, question, userInfo, timeoutSignal);
						if ('error' in browseResult) {
							return { ...browseResult, url: inputUrl };
						}
						return { ...browseResult, url: inputUrl, question };
					} else {
						// Set regular browsing status
						if (addToStatus) {
							addToStatus(inputUrl, 'Browsing');
						}

						// Determine timeout based on URL type
						const timeoutMs = isPdfUrl(inputUrl) ? 180000 : 120000; // 3 minutes for PDFs, 2 minute default
						const timeoutSignal = createTimeoutSignal(abortSignal, timeoutMs);

						// Regular browse for non-YouTube URLs
						const browseResult = await performBrowse(
							inputUrl,
							timeoutSignal,
							userInfo,
							extensionCrawl,
							'textWithLinks',
							timeoutMs
						);
						if ('error' in browseResult) {
							return { ...browseResult, url: inputUrl };
						}
						return { ...browseResult, url: inputUrl, question };
					}
				} catch (error) {
					logger.warn('Browse task failed', { url: inputUrl, error });
					return {
						error: (error as Error).message || 'Browse task failed',
						url: inputUrl
					};
				}
			}
		)
	);

	// Task 2: Generate answer and extract relevant chunks
	pipeline.addStage(
		new TaskRunner<
			(BrowseSuccess & { url: string; question?: string }) | (BrowseError & { url: string }),
			| (BrowseSuccess & {
					generatedTitle: string;
					answer: string;
					url: string;
					question?: string;
					relevantChunkIds: UUID[];
			  })
			| (BrowseError & { url: string })
		>(
			10, // Concurrency limit of 10 requests to gemini at a time
			signal,
			async (browseResult, abortSignal) => {
				try {
					if ('error' in browseResult) {
						return browseResult;
					}
					if (addToStatus) {
						addToStatus(browseResult.url, 'Analyzing');
					}

					// Create a timeout signal for LLM analysis
					const timeoutSignal = createTimeoutSignal(abortSignal, 60000); // 60 second timeout

					// Determine if this is a YouTube URL
					const isYouTube = isYouTubeVideoUrl(browseResult.url);
					const contentType = isYouTube ? 'video' : browseResult.type === 'pdf' ? 'PDF' : 'webpage';

					const prompt = browseResult.question
						? `Answer the following question about the ${contentType} content in paragraph form: ${browseResult.question}. Also provide a maximum of 5 words for the title. Return only the relevant chunk IDs in the relevantChunkIds array that you used to answer the question (maximum of 20).`
						: `Summarize the content of the ${contentType} in paragraph form, and provide a maximum of 5 words for the title. Return only the relevant chunk IDs in the relevantChunkIds array that you used to summarize the content (maximum of 20).`;
					const messages = [
						{
							role: 'user',
							content: `${prompt}\n\nWebsite Chunks: ${browseResult.chunks.map((chunk) => `[${chunk.citationUUID}]: ${chunk.text}`).join('\n')}
						`
						}
					] as CoreMessage[];

					const schema = {
						type: 'object',
						properties: {
							title: {
								type: 'string',
								description: 'A concise title for the webpage content (5 words maximum)'
							},
							answer: {
								type: 'string',
								description: 'The answer to the question about the webpage content'
							},
							relevantChunkIds: {
								type: 'array',
								items: {
									type: 'string',
									description:
										'The UUIDs of the chunks of content that are relevant to the answer or summary'
								}
							}
						},
						required: ['title', 'answer', 'relevantChunkIds']
					};

					const result = await runGenerateObject({
						messages,
						schema: schema as JSONSchema7,
						model: 'gpt-5-nano',
						userInfo,
						abortSignal: timeoutSignal
						// gpt-5-nano doesn't support frequency penalty
						// additionalParams: {
						// 	frequencyPenalty: 1.0
						// }
					});

					if (!result) {
						return {
							error: 'Error: Failed to generate summary of tab content.',
							url: browseResult.url
						};
					}

					const { title, answer, relevantChunkIds } = result as {
						title: string;
						answer: string;
						relevantChunkIds: UUID[];
					};
					return {
						...browseResult,
						generatedTitle: title,
						answer,
						relevantChunkIds
					};
				} catch (error) {
					logger.warn('Error analyzing content', { url: browseResult.url, error });
					return {
						error: (error as Error).message || 'Error: Failed to generate summary of tab content.',
						url: browseResult.url
					};
				}
			}
		)
	);

	// Task 3: Post-processing and artifact update
	pipeline.addStage(
		new TaskRunner<
			| (BrowseSuccess & {
					generatedTitle: string;
					answer: string;
					url: string;
					question?: string;
					relevantChunkIds: UUID[];
			  })
			| (BrowseError & { url: string }),
			| (BrowseSuccess & {
					generatedTitle: string;
					answer: string;
					url: string;
					question?: string;
					relevantChunkIds: UUID[];
					relevantChunks: { citationUUID: UUID; text: string }[];
			  })
			| (BrowseError & { url: string })
		>(
			1, // Concurrency limit of 1 to ensure sequential processing
			signal,
			async (result) => {
				if ('error' in result) {
					return result;
				}
				// Extract relevant chunks based on relevantChunkIds
				const relevantChunks = result.chunks.filter((chunk) =>
					result.relevantChunkIds.includes(chunk.citationUUID)
				);

				const browseResult: BrowseWebpageResult = {
					title: result.generatedTitle,
					question: result.question,
					answer: result.answer,
					url: result.url,
					length: result.chunks.reduce((total, chunk) => total + chunk.text.length, 0),
					excerpt: result.excerpt,
					siteName: result.siteName,
					lang: result.lang,
					byline: result.byline,
					relevantChunks: relevantChunks,
					scrapedAt: new Date().toISOString(),
					publishedAt: result.publishedTime
				};

				// Update artifact
				artifact.results.push(browseResult);
				await updateArtifact(artifact, false);
				if (addToStatus) {
					addToStatus(result.url, 'Done');
				}
				return { ...result, relevantChunks };
			}
		)
	);

	return pipeline;
}

async function runBrowse(
	toolState: BrowseState,
	userInfo: UserInfo,
	helpers: ToolHelpers<ExtensionCrawlServer>,
	setDisplayStatus?: (status: string | string[]) => void
) {
	// Initialize artifact if there will be results
	const urls = toolState.inputs.urls;

	const artifactId = crypto.randomUUID();
	const artifact: BrowseWebpageArtifact = {
		id: artifactId,
		toolCallId: toolState.toolCallId,
		title: toolState.inputs.title || 'Browsed Webpages',
		type: 'browse-webpage',
		createdAt: new Date().toISOString(),
		urls: urls.map((u) => ({ url: u.url, question: u.question })),
		results: [],
		canOutput: true
	};
	await helpers.createArtifact(artifact);
	const statusMap = new Map<string, 'Browsing' | 'Watching' | 'Analyzing' | 'Done'>();
	try {
		const pipeline = createBrowsePipeline({
			artifact,
			userInfo,
			extensionCrawl: helpers.extensionCrawl,
			signal: helpers.abortSignal,
			updateArtifact: helpers.updateArtifact,
			addToStatus: (url, status) => {
				statusMap.set(url, status);
				if (setDisplayStatus) {
					const statusMessages = Array.from(statusMap.entries()).map(([url, status]) => {
						if (status === 'Browsing') return `Browsing ${url}`;
						if (status === 'Watching') return `Watching ${url}, give me a minute...`;
						if (status === 'Analyzing') return `Analyzing ${url}`;
						return `Completed ${url}`;
					});

					// Add pending URLs that aren't in the status map yet
					const pendingUrls = urls
						.map((u) => u.url)
						.filter((url) => !statusMap.has(url))
						.map((url) => `Pending ${url}`);

					const sortedStatusMessages = [
						// Show browsing first
						...statusMessages.filter((msg) => msg.startsWith('Browsing')),
						// Then watching
						...statusMessages.filter((msg) => msg.startsWith('Watching')),
						// Then analyzing
						...statusMessages.filter((msg) => msg.startsWith('Analyzing')),
						// Add pending URLs
						...pendingUrls
					];
					setDisplayStatus(sortedStatusMessages);
				}
			}
		});
		// Process each URL and update state as they complete
		const browseResults = await Promise.all(
			urls.map((url) => {
				return pipeline.execute({ url: url.url, question: url.question });
			})
		);

		const processed = browseResults.map((result) => {
			if ('error' in result) {
				return { url: result.url, error: result.error };
			}
			return {
				question: result.question,
				answer: result.answer,
				url: result.url,
				length: result.chunks.reduce((total, chunk) => total + chunk.text.length, 0),
				scrapedAt: new Date().toISOString(),
				relevantChunks: result.relevantChunks,
				links: result.links
			};
		});
		if (helpers.abortSignal.aborted) {
			toolState.status = 'stopped';
			return {
				message: 'Browse aborted',
				results: processed
			};
		}
		setDisplayStatus?.('Wrapping up...');
		// Add all annotations to the current message
		const annotations: Annotation[] = browseResults
			.filter((result) => result !== null)
			.flatMap((result) => {
				if ('error' in result) return [];
				return result.relevantChunks.map((chunk) => ({
					type: 'citation',
					citation: {
						type: 'browse_webpage_chunk',
						id: chunk.citationUUID
					}
				}));
			});

		// Update artifact in db
		await helpers.updateArtifact(artifact);

		// Check if any of the results contain errors
		const hasErrors = processed.some((result) => 'error' in result);

		// Create a more detailed message if there are errors
		let message = '';
		if (hasErrors) {
			const errorCount = processed.filter((result) => 'error' in result).length;
			const totalCount = processed.length;
			message = `${errorCount} out of ${totalCount} URLs could not be browsed successfully`;

			// Add specific error details for the first few errors
			const errorDetails = processed
				.filter((result) => 'error' in result)
				.slice(0, 3) // Limit to first 3 errors to avoid overly long messages
				.map((result) => `${result.url}: ${'error' in result ? result.error : 'Unknown error'}`)
				.join('\n');

			if (errorDetails) {
				message += `\nErrors: \n${errorDetails}`;
				if (errorCount > 3) {
					message += `\n...and ${errorCount - 3} more`;
				}
			}
		} else {
			message = 'Successfully browsed all of the provided URLs';
		}
		toolState.status = 'success';
		return {
			message,
			results: processed,
			annotations,
			artifactsCreated: [
				{
					artifactType: artifact.type,
					artifactId: artifact.id as UUID,
					artifactTitle: artifact.title
				}
			]
		};
	} catch (error) {
		toolState.status = 'failed';
		logger.warn('Error running browse tool', error);
		return {
			message: 'Error: Failed to browse',
			results: [],
			annotations: [],
			artifactsCreated: [
				{
					artifactType: artifact.type,
					artifactId: artifact.id as UUID,
					artifactTitle: artifact.title
				}
			]
		};
	}
}

async function createOutputs(
	toolState: BrowseState,
	userInfo: UserInfo,
	helpers: ToolHelpers,
	intermediate: unknown
) {
	const results = intermediate as {
		message: string;
		results: BrowseState['outputs']['results'];
		annotations: Annotation[];
		artifactsCreated: ToolResult['artifactsCreated'];
	};
	toolState.outputs = {
		message: results.message,
		results: results.results
	};
	return {
		results: toolState,
		annotations: results.annotations,
		artifactsCreated: results.artifactsCreated
	};
}
