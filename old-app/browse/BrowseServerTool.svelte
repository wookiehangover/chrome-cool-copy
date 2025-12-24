<script lang="ts">
	import { type ToolInvocation } from 'ai';
	import ServerTool from '../components/tool-templates/server-tool/ServerTool.svelte';
	import { createToolStore } from '../components/types';
	import type { BrowseState } from './browse.server';
	import { cn } from '$lib/utils';
	import Icon from '@repo/ui/Icon.svelte';

	let {
		toolInvocation
	}: {
		toolInvocation: ToolInvocation;
	} = $props();

	$effect(() => {
		if (toolInvocation.state === 'call') {
			browseState.setFromToolInvocation(toolInvocation);
		}
	});

	let browseState = createToolStore<BrowseState>((invocation: ToolInvocation) => {
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
	}, toolInvocation);
</script>

<ServerTool
	displayIcon="browse-tool"
	displayTitle="Browsing"
	displayDescription={$browseState?.inputs?.title || toolInvocation?.args?.title
		? `${$browseState?.inputs?.title || toolInvocation?.args?.title} (${$browseState?.inputs?.urls?.length || 0} URLs)`
		: ''}
	{toolInvocation}
	toolState={browseState}
	children={form}
/>

{#snippet form()}
	<div class="flex flex-col gap-3">
		<div class="w-full text-xs font-medium text-black dark:text-white">Questions:</div>
		{#each $browseState?.inputs.urls || [{ url: '', question: '' }] as urlItem, index}
			<div class="flex flex-col gap-2">
				<div class={cn('flex flex-col items-start')}>
					<div class="w-full text-xs wrap-break-word text-gray-500 dark:text-gray-400">
						<div
							class="mb-1 flex flex-row items-start gap-2 text-xs text-gray-500 dark:text-gray-400"
						>
							<span
								>{urlItem.question ? urlItem.question : 'What is the content of this page?'}</span
							>
						</div>
						<div id={`url-${index}`} class="ml-3 flex items-start gap-2 font-light">
							<Icon name="corner-down-right" size={14} class="shrink-0" />
							{urlItem.url}
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/snippet}
