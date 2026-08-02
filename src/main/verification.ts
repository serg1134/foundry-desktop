// Automated verification clicks only controls with known reversible, local actions.
// The exported name is retained for the renderer-injected verifier, but the policy
// now fails closed: every label outside this allowlist is treated as unsafe.
export const destructiveControlPattern=/^(?!(?:[^a-z0-9]*)(?:(?:add|apply|back|cancel|choose|close|configure|continue|create|display|done|edit|filter|find|hide|list|load|new|next|notify|open|pause|previous|refresh|register|resume|retry|save|search|select|show|start|stop|submit|toggle|trigger|update)(?:\b|\s|$)|(?:copy|read|write)(?:\s+(?:to\s+)?(?:the\s+)?(?:os\s+)?clipboard)\b))/i;

export function isSafeInteractionLabel(label:string):boolean{
  return !destructiveControlPattern.test(label.trim());
}

export function isSafeWorkflowInteractionLabel(label:string,expectsClipboard:boolean):boolean{
  return isSafeInteractionLabel(label)||(expectsClipboard&&/^(?:copy|write)\b/i.test(label.trim()));
}
