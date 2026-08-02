import type { ProjectConfig } from './project-config';

export type CapabilityTier='supported'|'experimental'|'unsupported';
export type CapabilityKey=keyof ProjectConfig['capabilities'];
export type CapabilityAssessment={tier:CapabilityTier;summary:string;capabilities:CapabilityKey[];limitations:string[];matches:string[]};

type Rule={pattern:RegExp;label:string;capabilities?:CapabilityKey[]};

const supported:Rule[]=[
  {pattern:/\b(?:open|import|read|load)\b[\s\S]{0,40}\b(?:text|markdown|json|csv|tsv|log|file)s?\b/i,label:'Open user-selected text files',capabilities:['openTextFile']},
  {pattern:/\b(?:save|export|write|download)\b[\s\S]{0,40}\b(?:text|markdown|json|csv|file)s?\b/i,label:'Save user-selected text files',capabilities:['saveTextFile']},
  {pattern:/\b(?:folder|directory|file organizer|organize files)\b/i,label:'Inspect a user-selected folder',capabilities:['folderRead']},
  {pattern:/\b(?:database|sqlite|local storage|local persistence|persist|offline data|notes?|tasks?|expenses?|inventory)\b/i,label:'Store structured data locally',capabilities:['database']},
  {pattern:/\b(?:clipboard|copy and paste|copy to clipboard)\b/i,label:'Use the system clipboard',capabilities:['clipboardRead','clipboardWrite']},
  {pattern:/\b(?:notifications?|reminders?|toast|alert me)\b/i,label:'Show desktop notifications',capabilities:['notifications']},
  {pattern:/\b(?:system tray|tray icon|menu bar tool)\b/i,label:'Run from the system tray',capabilities:['tray']},
  {pattern:/\b(?:global shortcut|global hotkey|keyboard shortcut)\b/i,label:'Register global keyboard shortcuts',capabilities:['globalShortcuts']},
  {pattern:/\b(?:native menu|application menu|menu item)\b/i,label:'Configure native application menus',capabilities:['menus']},
  {pattern:/\b(?:deep link|custom url|app link)\b/i,label:'Handle app-specific links',capabilities:['deepLinks']},
  {pattern:/\b(?:https api|web api|fetch data|sync online|cloud api|weather api)\b/i,label:'Connect to encrypted web services',capabilities:['network']}
];

const experimental:Rule[]=[
  {pattern:/\b(?:start with windows|launch at startup|auto-?start|login item|background service|windows service)\b/i,label:'Startup and persistent background execution need additional lifecycle support'},
  {pattern:/\b(?:camera|microphone|screen capture|screen record|record(?:s|ing)? the screen)\b/i,label:'Camera, microphone, and screen capture permissions are not yet brokered'},
  {pattern:/\b(?:bluetooth|usb|serial port|gamepad|midi)\b/i,label:'Direct hardware integrations are not yet part of the verified capability broker'},
  {pattern:/\b(?:gpu|cuda|local ai model|machine learning model|onnx)\b/i,label:'Local GPU and model runtimes are outside the qualified template set'},
  {pattern:/\b(?:auto-?update|self update|silent update)\b/i,label:'Generated-app updates and rollback are not production-qualified'},
  {pattern:/\b(?:mac menu bar|macos menu bar)\b/i,label:'macOS menu-bar behavior requires a macOS build-and-sign verification run'}
];

const unsupported:Rule[]=[
  {pattern:/\b(?:kernel|kernel-mode|device driver|filesystem driver|filter driver|bootloader|uefi|raw disk)\b/i,label:'Kernel, driver, boot, and raw-disk software is not supported'},
  {pattern:/\b(?:antivirus|disable defender|disable norton|bypass antivirus|firewall driver|vpn driver)\b/i,label:'Security-product modification and network drivers are not supported'},
  {pattern:/\b(?:keylogger|steal passwords?|credential theft|ransomware|crypto miner|cryptominer|stealth persistence)\b/i,label:'Credential theft, surveillance, malware, and stealth persistence are prohibited'},
  {pattern:/\b(?:listen on (?:a )?port|open (?:a )?port|public server|local server accessible|accept incoming connections)\b/i,label:'Generated apps cannot expose inbound network servers yet'},
  {pattern:/\b(?:edit|modify|delete|clean)\b[\s\S]{0,30}\b(?:windows registry|system32|system files|boot configuration)\b/i,label:'Broad operating-system modification is not supported'}
];

export function assessCapabilityRequest(prompt:string):CapabilityAssessment{
  const request=prompt.trim(),blocked=unsupported.filter(rule=>rule.pattern.test(request)),limited=experimental.filter(rule=>rule.pattern.test(request)),matched=supported.filter(rule=>rule.pattern.test(request));
  const capabilities=[...new Set(matched.flatMap(rule=>rule.capabilities??[]))];
  if(blocked.length)return{tier:'unsupported',summary:'This request needs desktop access Foundry cannot safely build or verify.',capabilities,limitations:blocked.map(rule=>rule.label),matches:matched.map(rule=>rule.label)};
  if(limited.length)return{tier:'experimental',summary:'Foundry can attempt part of this request, but some required behavior is not production-qualified.',capabilities,limitations:limited.map(rule=>rule.label),matches:matched.map(rule=>rule.label)};
  return{tier:'supported',summary:capabilities.length?'Foundry can build this request using its verified desktop capability broker.':'Foundry can build this request within the standard local desktop template.',capabilities,limitations:[],matches:matched.map(rule=>rule.label)};
}

export function unsupportedCapabilityMessage(assessment:CapabilityAssessment):string{
  return`${assessment.summary} ${assessment.limitations.join(' ')} Try a user-level desktop app using local data, user-selected files, notifications, clipboard tools, tray controls, or encrypted web APIs.`;
}
