export type TemplateId='blank'|'notes'|'tasks'|'expenses'|'dashboard';
export const projectTemplates=[
 {id:'blank' as const,name:'Custom app',description:'A minimal React desktop app ready for any prompt.'},
 {id:'notes' as const,name:'Notes',description:'A working local notes app with search and editing.'},
 {id:'tasks' as const,name:'Task manager',description:'A persistent task workflow with filters and completion.'},
 {id:'expenses' as const,name:'Expense tracker',description:'Local expense entry, categories, totals, and history.'},
 {id:'dashboard' as const,name:'Dashboard',description:'A polished dashboard with cards, navigation, and activity.'}
];
