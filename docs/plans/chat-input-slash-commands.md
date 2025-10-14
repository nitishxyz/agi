# Chat Input Slash Command Plan

## Overview
Implement `/`-triggered commands in the chat input to streamline session control and configuration access. Command autocomplete should behave like existing file mentions: it appears instantly when the input is empty and a slash is typed, supports keyboard navigation, and executes the chosen action on enter.

## Goals
- `/models` opens the configuration modal with focus on the model selector.
- `/agents` opens the configuration modal with focus on the agent selector.
- `/new` creates a new session and navigates to it.
- Command autocomplete only activates when the textarea contains just the leading `/` and optional command characters.
- Executing a command clears the chat input.

## Tasks
1. **Detect slash commands in `ChatInput.tsx`**
   - Track command query state when the textarea starts with `/` and is otherwise empty.
   - Reuse the text-area sizing, focus, and key handling patterns already in place.

2. **Render a command suggestions popup**
   - Create a `CommandSuggestionsPopup` component colocated with `FileMentionPopup` for consistent styling and placement.
   - Support keyboard navigation (Arrow keys, Ctrl+J/K) and enter selection mirroring the mention popup behavior.

3. **Execute commands via `ChatInputContainer.tsx`**
   - Surface an `onCommand` callback from `ChatInput` that emits the selected command identifier.
   - Handle `/models` and `/agents` by opening the config modal and setting a focus target; handle `/new` by invoking a supplied new-session callback.

4. **Focus specific controls in the config modal**
   - Extend `ConfigModal`, `UnifiedAgentSelector`, and `UnifiedModelSelector` with imperative focus helpers so the correct input is targeted when the modal opens.

5. **Wire session creation from layout**
   - Pass the existing `handleNewSession` from `SessionsLayout` into `ChatInputContainer` so `/new` reuses the established navigation and UI side effects.

6. **Polish and validate**
   - Ensure the command popup dismisses when text no longer matches a command pattern or after command execution.
   - Confirm command execution clears the textarea and restores focus.
   - Add follow-up TODO for potential UI hints/command help if desired.
