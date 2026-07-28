export const destructiveControlPattern=/delete|remove|clear|erase|purchase|buy|pay|checkout|uninstall|reset/i;

export function isSafeInteractionLabel(label:string):boolean{
  return !destructiveControlPattern.test(label.trim());
}
