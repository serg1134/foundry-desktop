// Automated verification clicks only controls with known reversible, local actions.
// The exported name is retained for the renderer-injected verifier, but the policy
// now fails closed: every label outside this allowlist is treated as unsafe.
export const destructiveControlPattern=/^(?!(?:add|apply|back|cancel|close|continue|create|done|edit|filter|find|hide|new|next|open|pause|previous|refresh|resume|retry|save|search|select|show|start|stop|submit|toggle|update)(?:\b|\s|$))/i;

export function isSafeInteractionLabel(label:string):boolean{
  return !destructiveControlPattern.test(label.trim());
}
