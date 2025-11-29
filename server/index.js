import express from "express";
import session from 'express-session';
import { Database } from "st.db";
import cors from "cors";
import dotenv from 'dotenv';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4343;
const ALLOWED_ORIGINS = (process.env.ORIGIN || process.env.VITE_ORIGIN || 'http://localhost:5173')
	.split(',')
	.map(origin => origin.trim())
	.filter(Boolean);
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-session-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.SERVER_BASE_URL || `http://localhost:${PORT}`}/auth/google/callback`;
const FRONTEND_REDIRECT = ALLOWED_ORIGINS[0] || 'http://localhost:5173';
const MAX_QUESTION_VALUE = 4;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GOOGLE_GEMINI_MODEL || 'gemini-2.5-flash';
const COMPANION_MODEL_NAME = process.env.GOOGLE_COMPANION_MODEL || 'gemini-2.0-flash';
const FOLLOW_UP_MODEL_NAME = process.env.GOOGLE_FOLLOWUP_MODEL || GEMINI_MODEL;
const NODE_ENV = process.env.NODE_ENV || 'development';
// Configurable days before permanent doctor selection is required (default: 2 days)
const PERMANENT_DOCTOR_DAYS = parseInt(process.env.PERMANENT_DOCTOR_DAYS || '2', 10);
const PERMANENT_DOCTOR_MS = PERMANENT_DOCTOR_DAYS * 24 * 60 * 60 * 1000;

function getHost(value) {
	try {
		return value ? new URL(value).host : null;
	} catch {
		return null;
	}
}

const SERVER_BASE_URL = process.env.SERVER_BASE_URL || `http://localhost:${PORT}`;
const serverHost = getHost(SERVER_BASE_URL);
const crossSiteOriginHosts = ALLOWED_ORIGINS
	.filter(origin => origin !== '*')
	.map(getHost)
	.filter(Boolean);
const isCrossSite = crossSiteOriginHosts.length > 0
	? crossSiteOriginHosts.some(originHost => originHost !== serverHost)
	: false;

const sessionCookieSameSite = (() => {
	const configured = process.env.SESSION_COOKIE_SAMESITE;
	if (configured) {
		return configured.toLowerCase();
	}
	// In development, use 'lax' to allow cookies over HTTP
	// 'none' requires secure: true which doesn't work on HTTP
	return (NODE_ENV === 'production' && isCrossSite) ? 'none' : 'lax';
})();

const sessionCookieSecure = (() => {
	const configured = (process.env.SESSION_COOKIE_SECURE || '').toLowerCase();
	if (configured === 'true') return true;
	if (configured === 'false') return false;
	if (configured === 'auto') return 'auto';
	// If sameSite is 'none', we need secure: true
	if (sessionCookieSameSite === 'none') return true;
	// In development, allow insecure cookies for HTTP
	return NODE_ENV === 'production' ? 'auto' : false;
})();

let trustProxySetting;
const trustProxyInput = process.env.TRUST_PROXY;
if (typeof trustProxyInput !== 'undefined') {
	const numeric = Number.parseInt(trustProxyInput, 10);
	trustProxySetting = Number.isNaN(numeric) ? trustProxyInput : numeric;
} else if (sessionCookieSecure === true || sessionCookieSecure === 'auto') {
	trustProxySetting = 1;
}
if (typeof trustProxySetting !== 'undefined') {
	app.set('trust proxy', trustProxySetting);
}

const AI_SYSTEM_PROMPT = `You are "The Empathic Companion" inside a self-development and therapeutic application.
Your mission is to act as a compassionate, understanding friend and advisor for users who experience excessive daydreaming or mental escapism.

Core objectives:
- Help the user understand their mental and emotional state step by step.
- Encourage consistent improvement, focus, and transformation of dreams into real actions.
- Assess their condition through numeric indicators, in a friendly, non-clinical way.
- Offer emotional, moral, and spiritual support using wisdom, logic, and real-life inspiration.

Communication style:
- Always speak in the same language and dialect the user uses (Arabic, Egyptian, English, Levantine, etc.).
- Maintain a kind, gentle, and empathetic tone — calm, honest, and spiritually uplifting.
- Never lecture. Speak as a close, trustworthy friend.
- Use short proverbs, wise sayings, or religious reminders when appropriate and welcome.
- Motivate with real stories of people who overcame daydreaming, anxiety, or emotional pressure (e.g., Jim Carrey, Naguib Mahfouz, Mohamed Salah, J.K. Rowling, Vincent van Gogh, Adele).

During every session, gather information naturally through conversation, then give the user a numerical assessment across four indicators:
1. Daydreaming intensity (0 = none, 10 = very high)
2. Daily focus and task engagement (0 = very weak, 10 = excellent)
3. General mood (0 = deep sadness, 10 = happiness and stability)
4. Social or academic impact (0 = no effect, 10 = severe impact)

Provide a warm summary such as:
"My analysis shows your daydreaming level is around 7/10, but your focus has improved by 20%. That’s great progress."

Analysis method:
- Infer scores from words, expressed emotions, and the user’s consistency with previous exercises.
- Compare your assessment with their self-assessment if available, and reflect gently on any difference.

Privacy:
- Never store or send sensitive personal details. Summaries shared with specialists must only include the four indicators, trend (improving / worsening), emotional tone, and risk indicators — but only with explicit user consent.

Risk protocol:
- If critical thoughts appear, respond with deep compassion, ask gently about real intention, encourage immediate help, and offer to connect them with support lines while alerting the system per policy.

Motivation and exercises:
- Suggest two short focus-based games after each assessment: "Focus Tower" and "Memory of 3 Things".
- Link progress to rewards (e.g., stars, success stories unlocked with improvement).
- Share one brief success story tailored to the user’s tone and language when it will help.

Closing each session:
- Summarize their state kindly, highlight courage, and set a small, realistic step for next time.

Important boundaries:
- Never claim to diagnose. Provide behavioural and emotional insights only.
- Always respond in the same language and dialect as the latest user message or the language hint supplied.
- If unsure, politely ask the user to clarify their language preference.
`;

let companionModel = null;
let followUpModel = null;
if (GOOGLE_API_KEY) {
	try {
		const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
		companionModel = genAI.getGenerativeModel({
			model: COMPANION_MODEL_NAME,
			systemInstruction: {
				role: 'system',
				parts: [{ text: AI_SYSTEM_PROMPT }]
			}
		});

		const FOLLOW_UP_PROMPT = `You are a licensed therapist creating concise follow-up briefs for another doctor.

Guidelines:
- Remove all personally identifying or sensitive data (names, emails, phone numbers, addresses, exact schools, workplaces).
- Focus on emotional themes, behavioural changes, risks, and progress.
- Offer practical next steps that another clinician can act on.
- Score percentage improvement between 0-100 compared to previous report. 0 = worse, 50 = unchanged, 100 = remarkable progress.
- Keep tone professional, warm, and actionable.

Return ONLY valid JSON using this template:
{
  "summary": "2-3 sentences that capture the patient's state and themes.",
  "keyThemes": ["short bullet", "..."],
  "riskSignals": ["if none, use an empty array"],
  "nextSteps": ["action recommendation", "..."],
  "improvementPercentage": 0
}`;

		followUpModel = genAI.getGenerativeModel({
			model: FOLLOW_UP_MODEL_NAME,
			systemInstruction: {
				role: 'system',
				parts: [{ text: FOLLOW_UP_PROMPT }]
			}
		});
	} catch (error) {
		console.error('Failed to initialise Gemini model:', error);
	}
} else {
	console.warn('GOOGLE_API_KEY is not set. AI companion will be unavailable.');
}

async function getAccounts() {
	const data = await db.get("accounts");
	return Array.isArray(data) ? [...data] : [];
}

async function saveAccounts(accounts) {
	await db.set("accounts", accounts);
}

function ensureAccountDefaults(account = {}) {
	const enhanced = { ...account };
	let updated = false;

	if (!enhanced.provider) {
		enhanced.provider = 'local';
		updated = true;
	}
	if (typeof enhanced.role === 'undefined') {
		enhanced.role = null;
		updated = true;
	}
	if (typeof enhanced.assessment === 'undefined') {
		enhanced.assessment = null;
		updated = true;
	}
	if (typeof enhanced.assessmentCompleted === 'undefined') {
		enhanced.assessmentCompleted = !!enhanced.assessment;
		updated = true;
	}
	if (!enhanced.createdAt) {
		enhanced.createdAt = Date.now();
		updated = true;
	}
	if (!enhanced.languagePreference) {
		enhanced.languagePreference = 'en';
		updated = true;
	}
	if (typeof enhanced.selectedDoctor === 'undefined') {
		enhanced.selectedDoctor = null;
		updated = true;
	}
		if (typeof enhanced.noDoctor === 'undefined') {
			enhanced.noDoctor = false;
			updated = true;
		}
		if (!enhanced.doctorSelectionDate && enhanced.selectedDoctor) {
			enhanced.doctorSelectionDate = Date.now();
			updated = true;
		}
		if (!enhanced.permanentDoctorId) {
			enhanced.permanentDoctorId = null;
		updated = true;
	}
	if (!Array.isArray(enhanced.followUps)) {
		enhanced.followUps = [];
		updated = true;
	}
	if (updated) {
		enhanced.updatedAt = Date.now();
	}

	return { account: enhanced, updated };
}

function buildSessionUser(account = {}) {
	const daysSinceSelection = account.doctorSelectionDate 
		? Date.now() - account.doctorSelectionDate 
		: Infinity;
	const needsPermanentDoctor = daysSinceSelection >= PERMANENT_DOCTOR_MS && !account.permanentDoctorId;
	const timeUntilRequired = account.doctorSelectionDate && !account.permanentDoctorId
		? Math.max(0, PERMANENT_DOCTOR_MS - daysSinceSelection)
		: null;
	
	return {
		username: account.username,
		email: account.email,
		provider: account.provider || 'local',
		role: account.role ?? null,
		assessmentCompleted: !!account.assessmentCompleted,
		assessment: account.assessment || null,
		languagePreference: account.languagePreference || 'en',
		selectedDoctor: account.selectedDoctor || null,
		noDoctor: !!account.noDoctor,
		doctorDescription: account.doctorDescription || null,
		doctorSelectionDate: account.doctorSelectionDate || null,
		permanentDoctorId: account.permanentDoctorId || null,
		needsPermanentDoctor: needsPermanentDoctor,
		timeUntilPermanentRequired: timeUntilRequired,
		permanentDoctorDays: PERMANENT_DOCTOR_DAYS
	};
}

function classifyAssessmentLevel(percentage) {
	if (percentage <= 25) return 'mild';
	if (percentage <= 50) return 'moderate';
	if (percentage <= 75) return 'high';
	return 'severe';
}

function computeAssessment(answers = []) {
	const totalQuestions = answers.length;
	const maxScore = Math.max(totalQuestions * MAX_QUESTION_VALUE, 1);
	const score = answers.reduce((sum, value) => sum + value, 0);
	const rawPercentage = Math.round((score / maxScore) * 100);
	const percentage = Math.min(100, Math.max(0, rawPercentage));
	const level = classifyAssessmentLevel(percentage);
	return { score, percentage, level, maxScore };
}
const db = new Database({ path: "./db.json" });

// Get directory paths for file operations
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = path.join(__dirname, 'db');
const EMAIL_JSON_PATH = path.join(DB_DIR, 'email.json');

// Ensure db directory exists
if (!fs.existsSync(DB_DIR)) {
	fs.mkdirSync(DB_DIR, { recursive: true });
}

// Function to read chat history from email.json
async function readChatHistory() {
	try {
		if (fs.existsSync(EMAIL_JSON_PATH)) {
			const data = fs.readFileSync(EMAIL_JSON_PATH, 'utf8');
			return JSON.parse(data);
		}
		return {};
	} catch (error) {
		console.error('Error reading chat history:', error);
		return {};
	}
}

// Function to save chat history to email.json
async function saveChatHistory(email, userMessage, aiReply) {
	try {
		const chatHistory = await readChatHistory();
		
		if (!chatHistory[email]) {
			chatHistory[email] = [];
		}
		
		const chatEntry = {
			timestamp: Date.now(),
			userMessage: userMessage,
			aiReply: aiReply
		};
		
		chatHistory[email].push(chatEntry);
		
		// Keep only last 1000 messages per user to prevent file from growing too large
		if (chatHistory[email].length > 1000) {
			chatHistory[email] = chatHistory[email].slice(-1000);
		}
		
		fs.writeFileSync(EMAIL_JSON_PATH, JSON.stringify(chatHistory, null, 2), 'utf8');
	} catch (error) {
		console.error('Error saving chat history:', error);
	}
}

// Function to get chat history for a user
async function getChatHistory(email) {
	try {
		const chatHistory = await readChatHistory();
		return chatHistory[email] || [];
	} catch (error) {
		console.error('Error reading chat history:', error);
		return [];
	}
}

function generateId() {
	if (typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeText(text = '') {
	if (!text || typeof text !== 'string') return '';
	return text
		.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
		.replace(/\b(?:\+?\d{1,3}[-.\s]?)?(?:\d{3}[-.\s]?){2}\d{4}\b/g, '[redacted-phone]')
		.replace(/\b\d{5,}\b/g, '[redacted-number]')
		.trim();
}

function stripJsonMarkdown(text = '') {
	if (!text) return '';
	return text
		.replace(/```json/gi, '')
		.replace(/```/g, '')
		.trim();
}

function clampPercentage(value, fallback = 50) {
	const number = Number.parseFloat(value);
	if (Number.isNaN(number)) return Math.min(100, Math.max(0, fallback));
	return Math.min(100, Math.max(0, number));
}

function buildConversationTranscript(history = [], limit = 12) {
	if (!Array.isArray(history) || history.length === 0) {
		return 'No recent conversation was captured.';
	}
	return history
		.slice(-limit)
		.map(entry => {
			const userLine = sanitizeText(entry.userMessage || '');
			const aiLine = sanitizeText(entry.aiReply || '');
			return `Patient: ${userLine}\nCompanion: ${aiLine}`;
		})
		.join('\n');
}

async function createFollowUpSummary({ patient, chatHistory }) {
	const defaultSummary = {
		summary: 'Patient session ended. No additional context captured.',
		keyThemes: [],
		riskSignals: [],
		nextSteps: [],
		improvementPercentage: 50
	};

	const transcript = buildConversationTranscript(chatHistory, 14);

	if (!followUpModel) {
		return defaultSummary;
	}

	try {
		const prompt = `Create a clinical follow-up brief for the assigned doctor.
Patient alias: ${patient.username || patient.email}
Language preference: ${patient.languagePreference || 'en'}
Conversation excerpt:
${transcript}`;

		const result = await followUpModel.generateContent({
			contents: [{
				role: 'user',
				parts: [{ text: prompt }]
			}]
		});

		const raw =
			result?.response?.text?.()
			|| result?.response?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n')
			|| '';
		const parsed = JSON.parse(stripJsonMarkdown(raw));
		return {
			summary: sanitizeText(parsed.summary || defaultSummary.summary),
			keyThemes: Array.isArray(parsed.keyThemes) ? parsed.keyThemes.map(sanitizeText) : [],
			riskSignals: Array.isArray(parsed.riskSignals) ? parsed.riskSignals.map(sanitizeText) : [],
			nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.map(sanitizeText) : [],
			improvementPercentage: clampPercentage(parsed.improvementPercentage, defaultSummary.improvementPercentage)
		};
	} catch (error) {
		console.error('Failed to generate follow-up summary:', error);
		return defaultSummary;
	}
}

function resolveRedirectFromRequest(req) {
    const originHeader = req.headers.origin;
    if (originHeader && ALLOWED_ORIGINS.includes(originHeader)) {
        return originHeader;
    }
    const refererHeader = req.headers.referer;
    if (refererHeader) {
        const matchOrigin = ALLOWED_ORIGINS.find(origin => refererHeader.startsWith(origin));
        if (matchOrigin) return matchOrigin;
    }
    return FRONTEND_REDIRECT;
}

// Enable CORS for frontend
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }

        if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }

        try {
            const parsedOrigin = new URL(origin);
            const originHostname = parsedOrigin.hostname;
            const serverHostname = (process.env.SERVER_BASE_URL ? new URL(process.env.SERVER_BASE_URL).hostname : undefined)
                || (process.env.HOSTNAME)
                || (process.env.NODE_ENV !== 'production' ? 'localhost' : undefined);

            if (serverHostname && originHostname === serverHostname) {
                return callback(null, true);
            }

            const requestHostHeader = parsedOrigin.hostname;
            const corsMatches = ALLOWED_ORIGINS.some((allowed) => {
                try {
                    const allowedUrl = new URL(allowed);
                    return allowedUrl.hostname === originHostname;
                } catch (e) {
                    return false;
                }
            });

            if (corsMatches) {
                return callback(null, true);
            }
        } catch (err) {
            console.error('CORS origin parse error:', err);
        }

        console.warn('Blocked CORS origin:', origin);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(session({
    secret: SESSION_SECRET,
    name: 'mentis.session',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: sessionCookieSecure,
        httpOnly: true,
        sameSite: sessionCookieSameSite,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/signup', async (req, res) => {
	try {
		const { email, username, password } = req.body;
		console.log(email, username, password);

		if (!email || !username || !password) {
			return res.status(400).json({ error: 'Missing required fields.' });
		}

		const accounts = await getAccounts();
		const exists = accounts.find(acc => acc.email === email);
    	if (exists) {
			return res.status(400).json({ error: 'This email already exists.' });
		}

		const newAccount = {
			email,
			username,
			password,
			provider: 'local',
			role: null,
			assessment: null,
			assessmentCompleted: false,
			createdAt: Date.now(),
			updatedAt: Date.now()
		};

		const { account: normalized } = ensureAccountDefaults(newAccount);
		accounts.push(normalized);
		await saveAccounts(accounts);

		const sessionPayload = buildSessionUser(normalized);
		req.session.user = sessionPayload;
		
		const redirectUrl = resolveRedirectFromRequest(req);
		res.json({ success: true, redirect: redirectUrl, user: sessionPayload });
	} catch (err) {
		console.error('Signup error:', err);
		res.status(500).json({ error: 'Failed to create account.' });
	}
});

app.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body;
		console.log(email, password);

		if (!email || !password) {
			return res.status(400).json({ error: 'Missing email or password.' });
		}

		const accounts = await getAccounts();
		const index = accounts.findIndex(acc => acc.email === email && acc.password === password);

		if (index === -1) {
			return res.status(401).json({ error: 'Invalid email or password.' });
		}

		const { account: normalized, updated } = ensureAccountDefaults(accounts[index]);
		if (updated) {
			accounts[index] = normalized;
			await saveAccounts(accounts);
		}

		const sessionPayload = buildSessionUser(normalized);
		req.session.user = sessionPayload;

		const redirectUrl = resolveRedirectFromRequest(req);
		res.json({ success: true, redirect: redirectUrl, user: sessionPayload });
	} catch (err) {
		console.error('Login error:', err);
		res.status(500).json({ error: 'Login failed.' });
	}
});

app.get('/session', async (req, res) => {
	try {
		const sessionUser = req.session.user;
		if (!sessionUser?.email) {
			return res.status(401).json({ user: null });
		}

		const accounts = await getAccounts();
		const index = accounts.findIndex(acc => acc.email === sessionUser.email);
		if (index === -1) {
			req.session.destroy(() => {});
			return res.status(401).json({ user: null });
		}

		const { account: normalized, updated } = ensureAccountDefaults(accounts[index]);
		if (updated) {
			accounts[index] = normalized;
			await saveAccounts(accounts);
		}

		const sessionPayload = buildSessionUser(normalized);
		req.session.user = sessionPayload;
		res.json({ user: sessionPayload });
	} catch (err) {
		console.error('Session retrieval error:', err);
		res.status(500).json({ error: 'Failed to fetch session.' });
	}
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true });
    });
});

app.post('/user/role', async (req, res) => {
	try {
		const sessionUser = req.session.user;
		if (!sessionUser?.email) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const { role } = req.body;
		if (!['doctor', 'patient'].includes(role)) {
			return res.status(400).json({ error: 'Invalid role selection.' });
		}

		const accounts = await getAccounts();
		const index = accounts.findIndex(acc => acc.email === sessionUser.email);
		if (index === -1) {
			return res.status(404).json({ error: 'Account not found.' });
		}

		const { account: normalized } = ensureAccountDefaults(accounts[index]);
		normalized.role = role;
		// noDoctor flag will be set during assessment, not during role selection
		if (role === 'doctor') {
			normalized.assessmentCompleted = true;
		} else if (role === 'patient' && !normalized.assessment) {
			normalized.assessmentCompleted = false;
		}
		normalized.updatedAt = Date.now();

		accounts[index] = normalized;
		await saveAccounts(accounts);

		const sessionPayload = buildSessionUser(normalized);
		req.session.user = sessionPayload;
		req.session.touch(); // Mark session as modified
		
		res.json({ success: true, role, user: sessionPayload });
	} catch (err) {
		console.error('Role selection error:', err);
		res.status(500).json({ error: 'Failed to update role.' });
	}
});

app.post('/doctor/description', async (req, res) => {
	try {
		const sessionUser = req.session.user;
		if (!sessionUser?.email) {
			return res.status(401).json({ error: 'Unauthorized' });
		}
		if (sessionUser.role !== 'doctor') {
			return res.status(403).json({ error: 'Only doctors can update their description.' });
		}

		const { description } = req.body;
		if (typeof description !== 'string' || !description.trim()) {
			return res.status(400).json({ error: 'Description is required.' });
		}

		const accounts = await getAccounts();
		const index = accounts.findIndex(acc => acc.email === sessionUser.email);
		if (index === -1) {
			return res.status(404).json({ error: 'Account not found.' });
		}

		const { account: normalized } = ensureAccountDefaults(accounts[index]);
		normalized.doctorDescription = description.trim();
		normalized.updatedAt = Date.now();

		accounts[index] = normalized;
		await saveAccounts(accounts);

		const sessionPayload = buildSessionUser(normalized);
		req.session.user = sessionPayload;
		req.session.touch();

		res.json({ success: true, user: sessionPayload });
	} catch (err) {
		console.error('Doctor description update error:', err);
		res.status(500).json({ error: 'Failed to update description.' });
	}
});

app.post('/assessment', async (req, res) => {
	try {
		const sessionUser = req.session.user;
		if (!sessionUser?.email) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const { answers, language, summary, doctorId, noDoctor } = req.body;
		if (!Array.isArray(answers) || answers.length !== 10) {
			return res.status(400).json({ error: 'All ten answers are required.' });
		}

		const sanitizedAnswers = answers.map(Number);
		if (sanitizedAnswers.length !== answers.length || sanitizedAnswers.some(val => !Number.isInteger(val) || val < 1 || val > MAX_QUESTION_VALUE)) {
			return res.status(400).json({ error: 'Invalid answer values.' });
		}

		const accounts = await getAccounts();
		const index = accounts.findIndex(acc => acc.email === sessionUser.email);
		if (index === -1) {
			return res.status(404).json({ error: 'Account not found.' });
		}

		const computed = computeAssessment(sanitizedAnswers);
		const { account: normalized } = ensureAccountDefaults(accounts[index]);

		const doctorAccounts = accounts
			.filter(acc => (acc.role === 'doctor'))
			.map(acc => ({
				id: acc.email,
				name: acc.username || acc.email,
				email: acc.email,
				languages: Array.isArray(acc.languages) ? acc.languages : [acc.languagePreference || 'en'],
				location: acc.location || null,
				speciality: acc.speciality || 'Mentis Anchora Specialist'
			}));

		// Handle noDoctor flag from request
		const shouldSetNoDoctor = noDoctor === true;
		
		// If wantsDoctor is true (noDoctor is false), no doctor selection is required in assessment
		// Doctor selection will happen in the chat interface
		let assignedDoctor = null;
		if (normalized.role === 'patient') {
			if (shouldSetNoDoctor) {
				// User chose "no doctor" option
				assignedDoctor = null;
			} else {
				// User wants doctor but will select from chat interface
				// No doctor selection required here
				assignedDoctor = null;
			}
		} else if (doctorId) {
			assignedDoctor = doctorAccounts.find(doc => doc.id === doctorId) || null;
		}

		const doctorSnapshot = assignedDoctor ? { ...assignedDoctor } : null;

		const assessmentRecord = {
			answers: sanitizedAnswers,
			score: computed.score,
			percentage: computed.percentage,
			level: computed.level,
			maxScore: computed.maxScore,
			language: language || normalized.languagePreference || 'en',
			summary: summary || null,
			completedAt: Date.now(),
			selectedDoctor: doctorSnapshot
		};

		normalized.assessment = assessmentRecord;
		normalized.assessmentCompleted = true;
		normalized.noDoctor = shouldSetNoDoctor;
		if (shouldSetNoDoctor) {
			normalized.selectedDoctor = null;
			normalized.doctorSelectionDate = null;
			normalized.permanentDoctorId = null;
		} else {
			// User wants doctor but hasn't selected one yet - will select from chat interface
			normalized.selectedDoctor = null;
			// doctorSelectionDate will be set when they first select a doctor from chat
		}
		if (language) {
			normalized.languagePreference = language;
		}
		normalized.updatedAt = Date.now();

		accounts[index] = normalized;
		await saveAccounts(accounts);

		const sessionPayload = buildSessionUser(normalized);
		req.session.user = sessionPayload;

		res.json({ success: true, assessment: assessmentRecord, user: sessionPayload });
	} catch (err) {
		console.error('Assessment error:', err);
		res.status(500).json({ error: 'Failed to save assessment.' });
	}
});

app.post('/ai/chat', async (req, res) => {
	try {
		const sessionUser = req.session?.user;
		if (!sessionUser) {
			return res.status(401).json({ error: 'Not authenticated.' });
		}
		if (sessionUser.role !== 'patient') {
			return res.status(403).json({ error: 'Only patients can use the Empathic Companion.' });
		}
		if (!companionModel) {
			return res.status(503).json({ error: 'AI companion is currently unavailable.' });
		}

		const { message, history = [], language = 'auto' } = req.body || {};
		const trimmed = typeof message === 'string' ? message.trim() : '';
		if (!trimmed) {
			return res.status(400).json({ error: 'Message is required.' });
		}

		const sanitizedHistory = Array.isArray(history)
			? history
				.filter(item => item && typeof item.role === 'string' && typeof item.text === 'string' && item.text.trim().length)
				.slice(-10)
				.map(item => ({
					role: item.role === 'assistant' ? 'model' : 'user',
					parts: [{ text: item.text.trim() }]
				}))
				.filter((item, index, array) => {
					if (index === 0 && item.role === 'model') {
						return false;
					}
					const prev = array[index - 1];
					return !(prev && prev.role === item.role);
				})
			: [];

		const languageHint = typeof language === 'string' && language !== 'auto' ? language : null;
		const composedMessage = languageHint
			? `${trimmed}\n\nThe user is communicating in ${languageHint}. Continue in this language.`
			: `${trimmed}\n\nAlways reply in the same language and dialect that I am using.`;

		const chatHistory = sanitizedHistory.length
			? sanitizedHistory
				.filter((item, index) => index > 0 || item.role !== 'model')
			: [];

		const RETRIABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

		for (let attempt = 1; attempt <= 3; attempt += 1) {
			try {
				const chat = companionModel.startChat({ history: chatHistory });
				const result = await chat.sendMessage(composedMessage);
				const reply = result?.response?.text?.() || '';

				// Save chat history to email.json
				await saveChatHistory(sessionUser.email, trimmed, reply);

				return res.json({ reply });
			} catch (error) {
				const status = error?.status ?? error?.response?.status ?? 500;
				const message = (error?.message || '').toLowerCase();
				const isOverloaded = message.includes('overload') || message.includes('unavailable');
				const shouldRetry = RETRIABLE_STATUS.has(status) || isOverloaded;

				if (!shouldRetry || attempt === 3) {
					console.error('AI companion error:', error);
					const responseStatus = shouldRetry ? 503 : status;
					const fallbackMessage = shouldRetry
						? 'The Empathic Companion is taking a short break. Please try again in a moment.'
						: 'Unable to reach the companion right now.';
					return res.status(responseStatus).json({ error: fallbackMessage });
				}

				const delay = 400 * attempt;
				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
	} catch (error) {
		console.error('AI companion error:', error);
		return res.status(500).json({ error: 'Unable to reach the companion right now.' });
	}
});

app.post('/ai/follow-up', async (req, res) => {
	try {
		const sessionUser = req.session?.user;
		if (!sessionUser) {
			return res.status(401).json({ error: 'Not authenticated.' });
		}
		if (sessionUser.role !== 'patient') {
			return res.status(403).json({ error: 'Only patients can submit follow-ups.' });
		}

		const accounts = await getAccounts();
		const index = accounts.findIndex(acc => acc.email === sessionUser.email);
		if (index === -1) {
			return res.status(404).json({ error: 'Account not found.' });
		}

		const patient = accounts[index];
		const { account: normalized, updated } = ensureAccountDefaults(patient);
		if (updated) {
			accounts[index] = normalized;
		}

		// Prevent follow-up creation for users who chose "no doctor" option
		if (normalized.noDoctor) {
			return res.status(400).json({ error: 'Follow-ups are only available when a doctor is assigned. You chose to use the AI companion without a doctor.' });
		}

		if (!normalized.selectedDoctor?.id) {
			return res.status(400).json({ error: 'A doctor must be selected before sending follow-ups.' });
		}

		// Check configurable days rule: if more than PERMANENT_DOCTOR_DAYS have passed, require permanent doctor
		const daysSinceSelection = normalized.doctorSelectionDate 
			? Date.now() - normalized.doctorSelectionDate 
			: Infinity;
		
		if (daysSinceSelection >= PERMANENT_DOCTOR_MS) {
			// After the period, must have permanent doctor
			if (!normalized.permanentDoctorId) {
				return res.status(400).json({ 
					error: `After ${PERMANENT_DOCTOR_DAYS} days, you must choose one permanent doctor. Please select your permanent doctor first.` 
				});
			}
			// Can only share with permanent doctor after the period
			if (normalized.selectedDoctor?.id !== normalized.permanentDoctorId) {
				return res.status(400).json({ 
					error: `After ${PERMANENT_DOCTOR_DAYS} days, you can only share sessions with your permanent doctor.` 
				});
			}
		}
		// In first PERMANENT_DOCTOR_DAYS days, can share with any doctor (no restrictions)

		const chatHistory = await getChatHistory(normalized.email);
		if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
			return res.status(400).json({ error: 'No conversation history available to summarize.' });
		}

		const summary = await createFollowUpSummary({
			patient: normalized,
			chatHistory
		});

		const followUpEntry = {
			id: generateId(),
			createdAt: Date.now(),
			summary: summary.summary,
			keyThemes: summary.keyThemes,
			riskSignals: summary.riskSignals,
			nextSteps: summary.nextSteps,
			improvementPercentage: summary.improvementPercentage,
			doctorNotes: []
		};

		const existingFollowUps = Array.isArray(normalized.followUps) ? normalized.followUps : [];
		normalized.followUps = [...existingFollowUps, followUpEntry];
		normalized.updatedAt = Date.now();

		accounts[index] = normalized;
		await saveAccounts(accounts);

		return res.json({ success: true, followUp: followUpEntry });
	} catch (error) {
		console.error('Follow-up creation error:', error);
		return res.status(500).json({ error: 'Failed to create follow-up summary.' });
	}
});

app.post('/patient/permanent-doctor', async (req, res) => {
	try {
		const sessionUser = req.session?.user;
		if (!sessionUser || sessionUser.role !== 'patient') {
			return res.status(401).json({ error: 'Not authenticated.' });
		}

		const { doctorId } = req.body;
		if (!doctorId || typeof doctorId !== 'string') {
			return res.status(400).json({ error: 'Doctor ID is required.' });
		}

		const accounts = await getAccounts();
		const index = accounts.findIndex(acc => acc.email === sessionUser.email);
		if (index === -1) {
			return res.status(404).json({ error: 'Account not found.' });
		}

		const patient = accounts[index];
		const { account: normalized, updated } = ensureAccountDefaults(patient);
		if (updated) {
			accounts[index] = normalized;
		}

		// Verify doctor selection date exists
		if (!normalized.doctorSelectionDate) {
			return res.status(400).json({ error: 'You must first select a doctor from the chat interface.' });
		}

		// Allow setting permanent doctor at any time (optional before period ends, required after)
		// No need to check if days have passed - can set early if desired

		// Verify doctor exists
		const doctorAccounts = accounts.filter(acc => acc.role === 'doctor');
		const selectedDoctor = doctorAccounts.find(doc => doc.email === doctorId);
		if (!selectedDoctor) {
			return res.status(400).json({ error: 'Selected doctor not found.' });
		}

		// Set permanent doctor
		normalized.permanentDoctorId = doctorId;
		normalized.selectedDoctor = {
			id: selectedDoctor.email,
			name: selectedDoctor.username || selectedDoctor.email,
			email: selectedDoctor.email,
			languages: Array.isArray(selectedDoctor.languages) ? selectedDoctor.languages : [selectedDoctor.languagePreference || 'en'],
			location: selectedDoctor.location || null,
			speciality: selectedDoctor.speciality || 'Mentis Anchora Specialist',
			description: selectedDoctor.doctorDescription || null
		};
		normalized.updatedAt = Date.now();

		accounts[index] = normalized;
		await saveAccounts(accounts);

		const sessionPayload = buildSessionUser(normalized);
		req.session.user = sessionPayload;
		req.session.touch();

		res.json({ success: true, user: sessionPayload });
	} catch (err) {
		console.error('Permanent doctor selection error:', err);
		res.status(500).json({ error: 'Failed to set permanent doctor.' });
	}
});

app.post('/patient/change-doctor', async (req, res) => {
	try {
		const sessionUser = req.session?.user;
		if (!sessionUser || sessionUser.role !== 'patient') {
			return res.status(401).json({ error: 'Not authenticated.' });
		}

		const { doctorId } = req.body;
		if (!doctorId || typeof doctorId !== 'string') {
			return res.status(400).json({ error: 'Doctor ID is required.' });
		}

		const accounts = await getAccounts();
		const index = accounts.findIndex(acc => acc.email === sessionUser.email);
		if (index === -1) {
			return res.status(404).json({ error: 'Account not found.' });
		}

		const patient = accounts[index];
		const { account: normalized, updated } = ensureAccountDefaults(patient);
		if (updated) {
			accounts[index] = normalized;
		}

		// Track when patient first selects a doctor (if not already set)
		if (!normalized.doctorSelectionDate) {
			normalized.doctorSelectionDate = Date.now();
		}

		// Only allow changing doctor in first PERMANENT_DOCTOR_DAYS days
		const daysSinceSelection = Date.now() - normalized.doctorSelectionDate;
		if (daysSinceSelection >= PERMANENT_DOCTOR_MS) {
			if (normalized.permanentDoctorId) {
				return res.status(400).json({ 
					error: `After ${PERMANENT_DOCTOR_DAYS} days, you cannot change your permanent doctor.` 
				});
			}
			return res.status(400).json({ 
				error: `After ${PERMANENT_DOCTOR_DAYS} days, you must choose a permanent doctor first.` 
			});
		}

		// Verify doctor exists
		const doctorAccounts = accounts.filter(acc => acc.role === 'doctor');
		const selectedDoctor = doctorAccounts.find(doc => doc.email === doctorId);
		if (!selectedDoctor) {
			return res.status(400).json({ error: 'Selected doctor not found.' });
		}

		// Update selected doctor (only in first 2 days)
		normalized.selectedDoctor = {
			id: selectedDoctor.email,
			name: selectedDoctor.username || selectedDoctor.email,
			email: selectedDoctor.email,
			languages: Array.isArray(selectedDoctor.languages) ? selectedDoctor.languages : [selectedDoctor.languagePreference || 'en'],
			location: selectedDoctor.location || null,
			speciality: selectedDoctor.speciality || 'Mentis Anchora Specialist',
			description: selectedDoctor.doctorDescription || null
		};
		normalized.updatedAt = Date.now();

		accounts[index] = normalized;
		await saveAccounts(accounts);

		const sessionPayload = buildSessionUser(normalized);
		req.session.user = sessionPayload;
		req.session.touch();

		res.json({ success: true, user: sessionPayload });
	} catch (err) {
		console.error('Change doctor error:', err);
		res.status(500).json({ error: 'Failed to change doctor.' });
	}
});

app.get('/doctors', async (req, res) => {
	try {
		const accounts = await getAccounts();
		const doctors = accounts
			.filter(acc => acc.role === 'doctor')
			.map(acc => ({
				id: acc.email,
				name: acc.username || acc.email,
				email: acc.email,
				languages: Array.isArray(acc.languages) ? acc.languages : [acc.languagePreference || 'en'],
				location: acc.location || null,
				speciality: acc.speciality || 'Mentis Anchora Specialist',
				description: acc.doctorDescription || null,
				createdAt: acc.createdAt || null
			}));
		res.json({ doctors });
	} catch (err) {
		console.error('Failed to fetch doctors:', err);
		res.status(500).json({ error: 'Could not load doctors.' });
	}
});

app.get('/ai/chat/history', async (req, res) => {
	try {
		const sessionUser = req.session?.user;
		if (!sessionUser) {
			return res.status(401).json({ error: 'Not authenticated.' });
		}
		if (sessionUser.role !== 'patient') {
			return res.status(403).json({ error: 'Only patients can access chat history.' });
		}

		const history = await getChatHistory(sessionUser.email);
		res.json({ history });
	} catch (error) {
		console.error('Error fetching chat history:', error);
		res.status(500).json({ error: 'Failed to load chat history.' });
	}
});

app.get('/patient/followups', async (req, res) => {
	try {
		const sessionUser = req.session?.user;
		if (!sessionUser || sessionUser.role !== 'patient') {
			return res.status(401).json({ error: 'Not authenticated.' });
		}
		const accounts = await getAccounts();
		const index = accounts.findIndex(acc => acc.email === sessionUser.email);
		if (index === -1) {
			return res.status(404).json({ error: 'Account not found.' });
		}
		const { account: normalized, updated } = ensureAccountDefaults(accounts[index]);
		if (updated) {
			accounts[index] = normalized;
			await saveAccounts(accounts);
		}
		const followUps = Array.isArray(normalized.followUps) ? normalized.followUps : [];
		return res.json({
			followUps: followUps.map(entry => ({
				id: entry.id,
				summary: entry.summary,
				keyThemes: entry.keyThemes || [],
				nextSteps: entry.nextSteps || [],
				improvementPercentage: entry.improvementPercentage ?? null,
				createdAt: entry.createdAt,
				doctorNotes: Array.isArray(entry.doctorNotes) ? entry.doctorNotes : []
			})),
			doctor: normalized.selectedDoctor || null
		});
	} catch (error) {
		console.error('Failed to load patient follow-ups:', error);
		return res.status(500).json({ error: 'Could not load follow-up data.' });
	}
});

app.get('/doctor/followups', async (req, res) => {
	try {
		const sessionUser = req.session?.user;
		if (!sessionUser || sessionUser.role !== 'doctor') {
			return res.status(401).json({ error: 'Not authenticated.' });
		}
		const accounts = await getAccounts();
		const patients = accounts
			.filter(acc => acc.role === 'patient' && acc.selectedDoctor?.id === sessionUser.email)
			.map(acc => {
				const followUps = Array.isArray(acc.followUps) ? acc.followUps : [];
				return {
					email: acc.email,
					username: acc.username || acc.email,
					assessment: acc.assessment || null,
					followUps: followUps.map(entry => ({
						id: entry.id,
						createdAt: entry.createdAt,
						summary: entry.summary,
						keyThemes: entry.keyThemes || [],
						nextSteps: entry.nextSteps || [],
						improvementPercentage: entry.improvementPercentage ?? null,
						riskSignals: entry.riskSignals || [],
						doctorNotes: Array.isArray(entry.doctorNotes) ? entry.doctorNotes : []
					}))
				};
			});
		return res.json({ patients });
	} catch (error) {
		console.error('Failed to load doctor follow-ups:', error);
		return res.status(500).json({ error: 'Could not load follow-up records.' });
	}
});

app.post('/doctor/followups/:patientEmail/notes', async (req, res) => {
	try {
		const sessionUser = req.session?.user;
		if (!sessionUser || sessionUser.role !== 'doctor') {
			return res.status(401).json({ error: 'Not authenticated.' });
		}
		const { patientEmail } = req.params;
		const { followUpId, note } = req.body || {};
		if (!followUpId || typeof note !== 'string' || !note.trim()) {
			return res.status(400).json({ error: 'A follow-up ID and note are required.' });
		}

		const accounts = await getAccounts();
		const index = accounts.findIndex(acc => acc.email === patientEmail);
		if (index === -1) {
			return res.status(404).json({ error: 'Patient not found.' });
		}
		const patient = accounts[index];
		if (patient.selectedDoctor?.id !== sessionUser.email) {
			return res.status(403).json({ error: 'You are not assigned to this patient.' });
		}

		const followUps = Array.isArray(patient.followUps) ? [...patient.followUps] : [];
		const entryIndex = followUps.findIndex(entry => entry.id === followUpId);
		if (entryIndex === -1) {
			return res.status(404).json({ error: 'Follow-up entry not found.' });
		}

		const noteEntry = {
			id: generateId(),
			doctorId: sessionUser.email,
			doctorName: sessionUser.username || sessionUser.email,
			note: sanitizeText(note),
			createdAt: Date.now()
		};

		const existingNotes = Array.isArray(followUps[entryIndex].doctorNotes) ? followUps[entryIndex].doctorNotes : [];
		followUps[entryIndex] = {
			...followUps[entryIndex],
			doctorNotes: [...existingNotes, noteEntry]
		};

		patient.followUps = followUps;
		patient.updatedAt = Date.now();
		accounts[index] = patient;
		await saveAccounts(accounts);

		return res.json({ success: true, followUp: followUps[entryIndex] });
	} catch (error) {
		console.error('Failed to save doctor note:', error);
		return res.status(500).json({ error: 'Could not save note.' });
	}
});
app.get('/auth/google', (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
        console.error('Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI.');
        return res.status(500).send('Google OAuth is not configured.');
    }

    const redirectHint = typeof req.query.redirect === 'string' ? req.query.redirect : undefined;
    const redirectTarget = redirectHint && ALLOWED_ORIGINS.includes(redirectHint)
        ? redirectHint
        : resolveRedirectFromRequest(req);
    req.session.postAuthRedirect = redirectTarget;

    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'select_account');
    authUrl.searchParams.set('state', state);

    res.redirect(authUrl.toString());
});

app.get('/auth/google/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code) {
            return res.status(400).send('Missing authorization code');
        }

        if (!state || state !== req.session.oauthState) {
            return res.status(400).send('Invalid OAuth state');
        }

        delete req.session.oauthState;

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
            console.error('Google OAuth is not configured.');
            return res.status(500).send('Google OAuth is not configured.');
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            }).toString()
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Failed to exchange code for tokens:', errorText);
            return res.status(500).send('Failed to authenticate with Google.');
        }

        const tokenData = await tokenResponse.json();
        const { access_token, id_token } = tokenData;

        if (!access_token) {
            console.error('Missing access token in response');
            return res.status(500).send('Failed to authenticate with Google.');
        }

        let profile;
        const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });

        if (profileResponse.ok) {
            profile = await profileResponse.json();
        } else {
            console.error('Failed to fetch Google user profile');
            return res.status(500).send('Failed to fetch user profile from Google.');
        }

        const email = profile?.email;
        const name = profile?.name || profile?.given_name || 'Google User';

        if (!email) {
            return res.status(500).send('Google account is missing an email.');
        }

		const accounts = await getAccounts();
		let index = accounts.findIndex(acc => acc.email === email);
		let user;
		let shouldPersist = false;

		if (index === -1) {
			user = {
				email,
				username: name,
				provider: 'google',
				role: null,
				assessment: null,
				assessmentCompleted: false,
				selectedDoctor: null,
				languagePreference: 'en',
				createdAt: Date.now(),
				updatedAt: Date.now()
			};
			accounts.push(user);
			index = accounts.length - 1;
			shouldPersist = true;
		} else {
			const ensured = ensureAccountDefaults(accounts[index]);
			user = { ...ensured.account };
			if (!user.username) {
				user.username = name;
				shouldPersist = true;
			}
			if (user.provider !== 'google') {
				user.provider = 'google';
				shouldPersist = true;
			}
			if (ensured.updated) {
				shouldPersist = true;
			}
			if (shouldPersist) {
				user.updatedAt = Date.now();
			}
			accounts[index] = user;
		}

		if (shouldPersist) {
			await saveAccounts(accounts);
		}

		const sessionPayload = buildSessionUser(accounts[index]);
		req.session.user = sessionPayload;

        const redirectAfter = req.session.postAuthRedirect || FRONTEND_REDIRECT;
        delete req.session.postAuthRedirect;

        res.redirect(redirectAfter);
    } catch (err) {
        console.error('Google OAuth callback error:', err);
        res.status(500).send('Authentication failed.');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});  