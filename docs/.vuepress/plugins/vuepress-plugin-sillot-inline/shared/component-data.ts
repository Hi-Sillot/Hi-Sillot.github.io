export interface LabelColor {
	r: number;
	g: number;
	b: number;
	h: number;
	s: number;
	l: number;
}

export interface LabelEntry {
	fullName: string;
	color: LabelColor;
}

export const LABEL_MAP: Record<string, LabelEntry> = {
	Abolishment: {
		fullName: '- - - Abolishment ❌',
		color: { r: 217, g: 88, b: 11, h: 22, s: 90, l: 44 },
	},
	Assess: {
		fullName: '- - - Assess 🛸',
		color: { r: 43, g: 64, b: 95, h: 215, s: 37, l: 27 },
	},
	Bug: {
		fullName: '- - - Bug 🩸',
		color: { r: 255, g: 26, b: 42, h: 355, s: 100, l: 55 },
	},
	Enhancement: {
		fullName: '- - - Enhancement 🎢',
		color: { r: 29, g: 27, b: 10, h: 53, s: 48, l: 7 },
	},
	Ext: {
		fullName: '- - - Ext 🧩',
		color: { r: 83, g: 25, b: 231, h: 256, s: 81, l: 50 },
	},
	Feature: {
		fullName: '- - - Feature 🧮',
		color: { r: 0, g: 107, b: 117, h: 185, s: 100, l: 22 },
	},
	Refactor: {
		fullName: '- - - Refactor ♻️',
		color: { r: 128, g: 93, b: 91, h: 3, s: 16, l: 42 },
	},
	Security: {
		fullName: '- - - Security ☢️',
		color: { r: 45, g: 114, b: 7, h: 98, s: 88, l: 23 },
	},
	Shinning: {
		fullName: '- - - Shinning 🍭',
		color: { r: 250, g: 250, b: 175, h: 60, s: 88, l: 83 },
	},
	DevEnv: {
		fullName: '- DevEnv 🧊',
		color: { r: 19, g: 19, b: 19, h: 0, s: 0, l: 7 },
	},
	Document: {
		fullName: '- Document 🔊',
		color: { r: 19, g: 19, b: 19, h: 0, s: 0, l: 7 },
	},
	Feedback: {
		fullName: '- Feedback 🚨',
		color: { r: 19, g: 19, b: 19, h: 0, s: 0, l: 7 },
	},
	HWD: {
		fullName: '- HWD 🐲',
		color: { r: 19, g: 19, b: 19, h: 0, s: 0, l: 7 },
	},
	Proxy: {
		fullName: '- Proxy 🟢',
		color: { r: 19, g: 19, b: 19, h: 0, s: 0, l: 7 },
	},
	T: {
		fullName: '- T☳ 🪷',
		color: { r: 19, g: 19, b: 19, h: 0, s: 0, l: 7 },
	},
};

export interface BannerEntry {
	flashCls: string;
	iconHtml: string;
	text: string;
}

export const BANNER_MAP: Record<string, BannerEntry> = {
	Archived: {
		flashCls: 'flash flash-warn flash-full border-top-0 text-center text-bold py-2',
		iconHtml: '<svg class="small-icon" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16"><path d="M0 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5V5a1 1 0 0 1-1-1zm2 3v7.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V5zm13-3H1v2h14zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5"></path></svg>',
		text: '此项目已归档',
	},
	PrLock: {
		flashCls: 'flash flash-warn flash-full border-top-0 text-center text-bold py-2',
		iconHtml: '<svg class="lock-icon" width="1.2rem" height="1.2rem" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4V4zm4-2.5a2.5 2.5 0 0 0-2.5 2.5v2h5V4A2.5 2.5 0 0 0 8 1.5zM3.75 7.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5z"></path></svg>',
		text: '此文章已锁定，不接受合并请求',
	},
	PrNeed: {
		flashCls: 'flash flash-green flash-full border-top-0 text-center text-bold py-2',
		iconHtml: '<svg class="github-icon" width="1.2rem" height="1.2rem" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>',
		text: '此文章尚未完善，欢迎参与贡献',
	},
	UpdateNeed: {
		flashCls: 'flash flash-warn flash-full border-top-0 text-center text-bold py-2',
		iconHtml: '♻️',
		text: '部分过时内容等待更新，注意甄别',
	},
};

export const VSCODE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><path d="M29.01,5.03,23.244,2.254a1.742,1.742,0,0,0-1.989.338L2.38,19.8A1.166,1.166,0,0,0,2.3,21.447c.025.027.05.053.077.077l1.541,1.4a1.165,1.165,0,0,0,1.489.066L28.142,5.75A1.158,1.158,0,0,1,30,6.672V6.605A1.748,1.748,0,0,0,29.01,5.03Z" style="fill:#0065a9"></path><path d="M29.01,26.97l-5.766,2.777a1.745,1.745,0,0,1-1.989-.338L2.38,12.2A1.166,1.166,0,0,1,2.3,10.553c.025-.027.05-.053.077-.077l1.541-1.4A1.165,1.165,0,0,1,5.41,9.01L28.142,26.25A1.158,1.158,0,0,0,30,25.328V25.4A1.749,1.749,0,0,1,29.01,26.97Z" style="fill:#007acc"></path><path d="M23.244,29.747a1.745,1.745,0,0,1-1.989-.338A1.025,1.025,0,0,0,23,28.684V3.316a1.024,1.024,0,0,0-1.749-.724,1.744,1.744,0,0,1,1.989-.339l5.765,2.772A1.748,1.748,0,0,1,30,6.6V25.4a1.748,1.748,0,0,1-.991,1.576Z" style="fill:#1f9cf0"></path></svg>';

export const CEDOSS_MAP: Record<string, string> = {
	sillotNoteName_yobeCe: '汐洛绞架',
	sillotNoteName_doCe: 'Sillot-Gibbet',
	syNoteName_CN: '思源笔记',
	syNoteName_EN: 'siyuan-note',
	sillot_yobeCe: '汐洛',
	sillot_doCe: 'Sillot',
	siow_yobeCe: '司华',
	siow_doCe: 'Siow',
	hellise_yobeCe: '赫礼斯',
	hellise_doCe: 'Hellise',
	potter_yobeCe: '叵特',
	potter_doCe: 'Potter',
	sofill_yobeCe: '沁棘',
	sofill_doCe: 'Sofill',
	sili_yobeCe: '司丽',
	sili_doCe: 'Sili',
	winsay_yobeCe: '风颂',
	winsay_doCo: 'Winsay',
	lnco_yobeCe: '兰可',
	lnco_doCe: 'Lnco',
};
