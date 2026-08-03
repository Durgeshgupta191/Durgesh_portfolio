const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const app = express();
const PORT = process.env.PORT || 3001;
const portfolioDataPath = path.join(__dirname, '..', 'data', 'portfolio-data.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..')));

function getPortfolioData() {
  const raw = fs.readFileSync(portfolioDataPath, 'utf8');
  return JSON.parse(raw);
}

function buildSystemPrompt(portfolioData) {
  return `You are Durgesh Gupta's Personal Portfolio Assistant.

Only answer using the portfolio data provided.
If information is unavailable, politely reply: "I don't have that information yet."
Never invent achievements, projects, companies, skills, or experience.

Portfolio data:
${JSON.stringify(portfolioData, null, 2)}`;
}

function formatConversationHistory(history = []) {
  return history.slice(-8).map((item) => `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.content}`).join('\n');
}

function getFallbackReply(message, portfolioData) {
  const text = String(message || '').toLowerCase();
  const personal = portfolioData.personalInformation || {};
  const projects = portfolioData.projects || [];
  const skills = portfolioData.skills || [];
  const experience = portfolioData.experience || [];
  const achievementData = portfolioData.achievements || {};
  const achievements = Array.isArray(achievementData)
    ? achievementData
    : Object.values(achievementData).flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean);
  const normalizedAchievements = Array.isArray(achievements) ? achievements : [achievements].filter(Boolean);
  const certificates = portfolioData.certificates || [];
  const education = portfolioData.education || [];
  const contact = portfolioData.contactInformation || {};
  const links = portfolioData.socialLinks || {};
  const whereAreYouFrom = portfolioData.whereAreYouFrom || {};

  const isLocationQuestion = /\b(where|which|what)\b.*\b(are|do|is|were|did|from|live|stay|home|hometown|belong|born|location|city|state)\b|\b(hometown|native place|birth place|kaha se ho|tum kaha se ho|aap kaha se ho|ghar kaha hai|ghar kahan hai|kahan rehte ho|kahan rahte ho|where do you stay|which place do you belong)\b/.test(text);

  if (isLocationQuestion && whereAreYouFrom.answer) {
    return whereAreYouFrom.answer;
  }

  if (text.includes('project') || text.includes('projects')) {
    const names = projects.map((p) => `- ${p.name}`).join('\n');
    return `Here are my featured projects:\n${names}\n\nIf you want, I can also describe any one of them in more detail.`;
  }

  if (text.includes('skill') || text.includes('skills')) {
    return `My skills include: ${skills.join(', ')}.`;
  }

  if (text.includes('experience') || text.includes('work')) {
    const items = experience.map((item) => `- ${item.role} at ${item.organization} (${item.period})`).join('\n');
    return `My experience includes:\n${items}`;
  }

  if (text.includes('education') || text.includes('study')) {
    const items = education.map((item) => `- ${item.degree} at ${item.institution} (${item.period})`).join('\n');
    return `My education includes:\n${items}`;
  }

  if (text.includes('certificate') || text.includes('certification')) {
    return `My certifications include:\n- ${certificates.join('\n- ')}`;
  }

  if (text.includes('achievement') || text.includes('achiev')) {
    if (!normalizedAchievements.length) {
      return "I don't have that information yet.";
    }
    return `My achievements include:\n- ${normalizedAchievements.join('\n- ')}`;
  }

  if (text.includes('resume')) {
    return `You can view my resume here: ${personal.resumeLink || 'not available yet'}.`;
  }

  if (text.includes('contact') || text.includes('email') || text.includes('phone')) {
    return `You can reach me at ${contact.email || 'email not available'} or ${contact.phone || 'phone not available'}.`;
  }

  if (text.includes('about') || text.includes('yourself') || text.includes('who')) {
    return `I’m ${personal.name || 'Durgesh Gupta'}. ${personal.title || 'Portfolio Assistant'}${personal.summary ? ` ${personal.summary}` : ''}`;
  }

  if (text.includes('github') || text.includes('linkedin')) {
    return `You can find me on GitHub: ${links.github || 'not available'} and LinkedIn: ${links.linkedin || 'not available'}.`;
  }

  return `I can help with your projects, skills, experience, resume, certifications, education, achievements, and contact details. Ask me anything related to Durgesh Gupta's portfolio.`;
}

app.post('/chat', async (req, res) => {
  try {
    const { message = '', history = [] } = req.body || {};

    if (!message.trim()) {
      return res.status(400).json({ reply: 'Please enter a question.' });
    }

    const portfolioData = getPortfolioData();
    const apiKey = process.env.GEMINI_API_KEY;

    let reply;

    if (!apiKey) {
      reply = getFallbackReply(message, portfolioData);
    } else {
      const prompt = `${buildSystemPrompt(portfolioData)}\n\nConversation history:\n${formatConversationHistory(history)}\n\nUser question:\n${message}`;

      try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            topP: 0.9,
            maxOutputTokens: 500
          }
        })
      });

        const data = await response.json();

        if (!response.ok || !data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error(data?.error?.message || 'Gemini request failed');
        }

        reply = data.candidates[0].content.parts[0].text.trim();
      } catch (error) {
        console.warn('Gemini unavailable, using fallback response:', error.message);
        reply = getFallbackReply(message, portfolioData);
      }
    }

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(502).json({ reply: 'Something went wrong. Please try again.' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Durgesh AI server listening on http://localhost:${PORT}`);
});
