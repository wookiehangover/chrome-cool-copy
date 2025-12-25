import { goto } from '$app/navigation';
import { extension } from '$lib/stores/extension';
import { createArtifact, updateArtifact } from '$lib/utils/artifacts';
import { parseHTML } from '$lib/utils/browse';
import { getYouTubeChunks, truncateAndGetChunks } from '$lib/utils/chunk';
import { runGenerateObject } from '$lib/utils/llm-client-side';
import { isYouTubeVideoUrl } from '$lib/utils/youtube';
import { apiClient } from '@repo/api-client';
import type { Annotation, BrowseError, BrowseSuccess, BrowseWebpageArtifact } from '@repo/types';
import type { ToolStatus } from '@repo/types/tool-types';
import { createCitation } from '@repo/utils/create-citation';
import { createScopedLogger } from '@repo/utils/logger';
import { tool, type CoreMessage, type ToolInvocation } from 'ai';
import { type UUID } from 'crypto';
import * as pdfjs from 'pdfjs-dist';
import { get } from 'svelte/store';
import { z } from 'zod';
import { TaskPipeline, TaskRunner } from '../components/TaskRunner';
import { createToolStore, type ToolContext, type ToolStore } from '../components/types';

const logger = createScopedLogger('browse-tool');

export const browse = tool({
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
	})
});

if (typeof window !== 'undefined') {
	pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.js';
}

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

export function createBrowseStore(invocation?: ToolInvocation) {
	return createToolStore<BrowseState>((invocation: ToolInvocation) => {
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
		if (invocation.state === 'result') {
			state.status = invocation.result?.status || 'success';
			state.inputs = invocation.result?.inputs || state.inputs;
			state.outputs = invocation.result?.outputs || {
				message: '',
				results: []
			};
		}
		return state;
	}, invocation);
}

// Extracts text from a PDF URL
export async function extractTextFromPDF(url: string): Promise<string> {
	try {
		// If the extension is installed use the proxy endpoint
		if (window.crawler && get(extension)?.installed) {
			const response = await window.crawler.proxy(url);
			if (response.error) {
				throw new Error(response.error);
			}
			url = response.content;
		} else {
			url = `/api/proxy?url=${encodeURIComponent(url)}`;
		}

		const textContent = await getTextContent(url);

		return textContent.join('\n');
	} catch (err) {
		logger.warn('Error extracting PDF text:', err);
		return 'PDF was unreadable';
	}
}

async function getTextContent(url: string): Promise<string[]> {
	const pdf = await pdfjs.getDocument(url).promise;
	const textContent = [];

	for (let i = 1; i <= pdf.numPages; i++) {
		const page = await pdf.getPage(i);
		const content = await page.getTextContent();
		const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
		textContent.push(`Page ${i}:\n${text}\n`);
	}

	return textContent;
}

function extractLinksFromMarkdown(markdown: string): Array<{ link_text: string; url: string }> {
	const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
	const links: Array<{ link_text: string; url: string }> = [];
	let match;

	while ((match = linkRegex.exec(markdown)) !== null) {
		const link_text = match[1];
		const url = match[2];
		if (url && !links.some((link) => link.url === url)) {
			links.push({ link_text, url });
		}
	}

	return links;
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
 * Extracts the video ID from a YouTube URL
 */
function getYouTubeVideoId(url: string): string | null {
	try {
		const urlObj = new URL(url);
		// Handle standard YouTube URLs
		if (
			(urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') &&
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
	abortSignal: AbortSignal,
	sessionId: string
): Promise<BrowseSuccess | BrowseError> {
	try {
		// Call the server endpoint to process the image using apiClient
		const result = await apiClient.call('analyzeMultimodalMaterials', {
			data: {
				materialIds: [],
				question: question || 'Describe this image in detail.',
				imageUrl: url,
				sessionId: sessionId
			},
			signal: abortSignal
		});

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
		const content = result.answer || 'No analysis available';
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
			publishedTime: '',
			links: []
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
async function processYouTubeVideo(
	url: string,
	question: string | undefined,
	sessionId: string,
	abortSignal: AbortSignal
): Promise<BrowseSuccess | BrowseError> {
	try {
		const videoId = getYouTubeVideoId(url);
		if (!videoId) {
			return {
				error: 'Invalid YouTube URL'
			};
		}

		// Call the server endpoint to process the YouTube video
		const result = await apiClient.call('processYouTubeVideo', {
			data: {
				url,
				question: question || 'Summarize this video content in detail.',
				sessionId: sessionId
			},
			signal: abortSignal
		});

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
			publishedTime: '',
			links: []
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

export async function performBrowse(
	url: string,
	abortSignal: AbortSignal
): Promise<BrowseSuccess | BrowseError> {
	// We don't handle YouTube URLs here anymore - they're handled in the pipeline
	// to ensure the question is passed correctly

	// Try using the extension first if installed
	if (get(extension)?.installationCompatible && window.crawler?.isAvailable) {
		try {
			const rawResult = await window.crawler.crawl(url);
			if (abortSignal.aborted) {
				logger.debug('Browse aborted');
				return {
					error: 'Browse aborted'
				};
			}
			if (rawResult.html.match(/embed[^>]*type="application\/pdf"/)) {
				// PDF.
				const fullText = await extractTextFromPDF(url);
				if (abortSignal.aborted) {
					logger.debug('Browse aborted');
					return {
						error: 'Browse aborted'
					};
				}
				const { chunks, truncated } = await truncateAndGetChunks(fullText);

				// TODO: Metadata for PDFs is possible, but punting on this since we should be using
				// materials pipeline for this type of stuff.
				return {
					type: 'pdf',
					chunks: chunks,
					title: url,
					truncated: truncated,
					excerpt: '',
					byline: '',
					dir: '',
					siteName: '',
					lang: '',
					publishedTime: ''
				} as BrowseSuccess;
			}
			if (abortSignal.aborted) {
				logger.debug('Browse aborted');
				return {
					error: 'Browse aborted'
				};
			}

			// Webpage.
			const browserReadability = parseHTML(rawResult.html, rawResult.url, undefined, 'turndown');
			if (abortSignal.aborted) {
				logger.debug('Browse aborted');
				return {
					error: 'Browse aborted'
				};
			}

			// Extract links from the markdown content
			let links = extractLinksFromMarkdown(browserReadability.textContent);
			// Limit to 20 random links if there are too many
			const maxLinks = 20;
			if (links.length > maxLinks) {
				// Fisher-Yates shuffle algorithm
				const shuffled = [...links];
				for (let i = shuffled.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
				}
				links = shuffled.slice(0, maxLinks);
			}
			const { chunks, truncated } = await truncateAndGetChunks(browserReadability.textContent);
			if (abortSignal.aborted) {
				logger.debug('Browse aborted');
				return {
					error: 'Browse aborted'
				};
			}

			return {
				type: 'webpage',
				chunks: chunks,
				truncated: truncated,
				title: browserReadability.title,
				excerpt: browserReadability.excerpt,
				byline: browserReadability.byline,
				dir: browserReadability.dir,
				siteName: browserReadability.siteName,
				lang: browserReadability.lang,
				publishedTime: browserReadability.publishedTime,
				links: links
			} as BrowseSuccess;
		} catch (error) {
			if ((error as Error).name === 'AbortError' || (error as Error).name === 'ProcessAbortError') {
				logger.debug('Browse aborted');
			} else {
				logger.warn('Browse request failed, using API fallback', error);
			}

			return {
				error: (error as Error).message
			};
		}
	}

	return {
		error: 'Browse request failed'
	};
}

export type CreateBrowsePipelineOptions = {
	sessionId: string;
	context: ToolContext;
	artifact: BrowseWebpageArtifact;
	toolCallId: string;
	signal: AbortSignal;
	addToStatus?: (url: string, status: 'Browsing' | 'Watching' | 'Analyzing' | 'Done') => void;
};

export function createBrowsePipeline(options: CreateBrowsePipelineOptions) {
	const { sessionId, context, artifact, toolCallId, signal, addToStatus } = options;

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
				// Process according to URL type
				if (isYouTubeVideoUrl(inputUrl)) {
					// Set YouTube status
					if (addToStatus) {
						addToStatus(inputUrl, 'Watching');
					}

					const browseResult = await processYouTubeVideo(
						inputUrl,
						question,
						sessionId,
						abortSignal
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

					// Process image URL using multimodal endpoint
					const browseResult = await processImageUrl(inputUrl, question, abortSignal, sessionId);
					if ('error' in browseResult) {
						return { ...browseResult, url: inputUrl };
					}
					return { ...browseResult, url: inputUrl, question };
				} else {
					// Set regular browsing status
					if (addToStatus) {
						addToStatus(inputUrl, 'Browsing');
					}

					// Regular browse for non-YouTube URLs
					const browseResult = await performBrowse(inputUrl, abortSignal);
					if ('error' in browseResult) {
						return { ...browseResult, url: inputUrl };
					}
					return { ...browseResult, url: inputUrl, question };
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
				if ('error' in browseResult) {
					return browseResult;
				}
				if (addToStatus) {
					addToStatus(browseResult.url, 'Analyzing');
				}

				const isYouTube = isYouTubeVideoUrl(browseResult.url);
				const contentType = isYouTube ? 'video' : browseResult.type === 'pdf' ? 'PDF' : 'webpage';

				// For YouTube videos, skip chunk selection
				if (isYouTube) {
					return {
						...browseResult,
						generatedTitle: browseResult.title,
						answer: browseResult.chunks.map((chunk) => chunk.text).join('\n\n'),
						relevantChunkIds: browseResult.chunks.map((chunk) => chunk.citationUUID)
					};
				}

				const messages = [
					{
						role: 'user',
						content: `Website Chunks: ${browseResult.chunks.map((chunk) => `[${chunk.citationUUID}]: ${chunk.text}`).join('\n')}
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

				const prompt = browseResult.question
					? `Answer the following question about the ${contentType} content in paragraph form: ${browseResult.question}. Also provide a maximum of 5 words for the title. Return only the relevant chunk IDs in the relevantChunkIds array that you used to answer the question (maximum of 20).`
					: `Summarize the content of the ${contentType} in paragraph form, and provide a maximum of 5 words for the title. Return only the relevant chunk IDs in the relevantChunkIds array that you used to summarize the content (maximum of 20).`;

				try {
					const result = await runGenerateObject(
						messages,
						schema,
						'gpt-5-nano',
						sessionId,
						abortSignal,
						prompt
					);

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
					logger.warn('Error analyzing content:', error);
					return {
						error: 'Error: Failed to generate summary of tab content.',
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

				// Create artifact update
				const artifactUpdate = {
					id: crypto.randomUUID(),
					toolCallId: toolCallId,
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
					scrapedAt: new Date().toISOString()
				};

				// Update artifact
				artifact.results.push(artifactUpdate);
				context.artifacts.update((artifacts) =>
					artifacts.map((a) => (a.id === artifact.id ? { ...artifact } : a))
				);
				if (addToStatus) {
					addToStatus(result.url, 'Done');
				}
				return { ...result, relevantChunks };
			}
		)
	);

	return pipeline;
}

export async function runBrowse(
	toolState: ToolStore<BrowseState>,
	context: ToolContext,
	toolInvocation: ToolInvocation,
	abortSignal: AbortSignal,
	setDisplayStatus?: (status: string | string[]) => void
) {
	const browseState = get(toolState);
	if (!browseState) {
		return {
			error: 'Error: No state provided for browse tool'
		};
	}
	const { sessionId } = context;

	// Initialize artifact if there will be results
	const urls = browseState.inputs.urls || toolInvocation.args?.urls || [];

	const artifactId = crypto.randomUUID();
	const artifact: BrowseWebpageArtifact = {
		id: artifactId,
		toolCallId: toolInvocation.toolCallId,
		title: browseState.inputs.title || toolInvocation.args?.title || 'Browsed Webpages',
		type: 'browse-webpage',
		createdAt: new Date().toISOString(),
		urls: urls.map((u) => ({ url: u.url, question: u.question })),
		results: []
	};
	await createArtifact(context.sessionId as UUID, context.artifacts, artifact);
	void goto(`/session/${context.sessionId}/artifacts/${artifactId}`, {
		noScroll: true
	});
	const statusMap = new Map<string, 'Browsing' | 'Watching' | 'Analyzing' | 'Done'>();
	const pipeline = createBrowsePipeline({
		sessionId,
		context,
		artifact,
		toolCallId: toolInvocation.toolCallId,
		signal: abortSignal,
		addToStatus: (url, status) => {
			statusMap.set(url, status);
			if (setDisplayStatus) {
				const statusMessages = [...statusMap.entries()].map(([url, status]) => {
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
			publishedAt: result.publishedTime,
			relevantChunks: result.relevantChunks,
			links: result.links
		};
	});
	if (abortSignal.aborted) {
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
	await updateArtifact(context.sessionId as UUID, context.artifacts, artifact);

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

	return {
		message,
		results: processed,
		annotations
	};
}
