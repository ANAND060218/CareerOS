import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '', timeout: 300000 });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('careeros_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const formatApiError = (err) => {
  if (err.code === 'ECONNABORTED') return 'Request timed out';
  if (err.response?.data?.detail) {
    const detail = err.response.data.detail;
    return typeof detail === 'string' ? detail : JSON.stringify(detail);
  }
  if (err.response?.data?.message) return err.response.data.message;
  if (err.message) return err.message;
  return 'Request failed';
};

export const login = async (email, password) => {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
};

export const register = async (email, password, name, role = 'Software Engineer') => {
  const res = await api.post('/auth/register', { email, password, name, role });
  return res.data;
};

export const getMe = async () => {
  const res = await api.get('/auth/me');
  return res.data;
};

export const getProfile = async () => {
  const res = await api.get('/auth/profile');
  return res.data;
};

export const updateProfile = async (data) => {
  const res = await api.patch('/auth/profile', data);
  return res.data;
};

export const deleteAccount = async () => {
  const res = await api.delete('/auth/account');
  return res.data;
};

export const patchMemory = async (data) => {
  const res = await api.patch('/memory/', data);
  return res.data;
};

export const getJobs = async ({ title = '', location = '', company = '', experience = '', page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (title) params.set('title', title);
  if (location) params.set('location', location);
  if (company) params.set('company', company);
  if (experience) params.set('experience', experience);
  params.set('page', String(page));
  params.set('limit', String(limit));
  const res = await api.get(`/jobs/?${params.toString()}`);
  return res.data;
};

export const getJob = async (id) => {
  const res = await api.get(`/jobs/${id}`);
  return res.data;
};

export const uploadResume = async (text) => {
  const res = await api.post('/resumes/upload', { text });
  return res.data;
};

export const uploadResumeFile = async (file, { autoWorkflow = false, jobId = null } = {}) => {
  const form = new FormData();
  form.append('file', file);
  const params = new URLSearchParams();
  if (autoWorkflow) params.set('auto_workflow', 'true');
  if (jobId) params.set('job_id', jobId);
  const res = await api.post(`/resumes/upload-file?${params.toString()}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const getMemory = async () => {
  const res = await api.get('/memory/');
  return res.data;
};

export const saveResumeMemory = async (data) => {
  const res = await api.post('/memory/', data);
  return res.data;
};

export const getLemmaStatus = async () => {
  const res = await api.get('/ai/lemma/status');
  return res.data;
};

export const runLemmaWorkflow = async (resume_text, job_description, company = '', job_id = null) => {
  const res = await api.post('/ai/autonomous', {
    resume_text,
    job_description,
    company,
    job_id,
    prefer_lemma: true,
  }, { timeout: 300000 });
  return res.data;
};

export const runLemmaWorkflowStream = async (resume_text, job_description, company = '', job_id = null, onEvent) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('careeros_token') : null;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const apiBase = import.meta.env.VITE_API_URL || '';
  const response = await fetch(`${apiBase}/ai/workflow/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      resume_text,
      job_description,
      company,
      job_id,
      prefer_lemma: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to start streaming workflow');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).strip ? line.slice(6).strip() : line.slice(6).trim();
        try {
          const eventData = JSON.parse(jsonStr);
          onEvent(eventData);
        } catch (e) {
          console.warn('Failed to parse SSE line:', line, e);
        }
      }
    }
  }
};

export const getWorkflowEvents = async () => {
  const res = await api.get('/events/');
  return res.data;
};

export const getRecommendations = async (limit = 10) => {
  const res = await api.post('/dashboard/recommendations', { limit });
  return res.data;
};

export const getAnalytics = async () => {
  const res = await api.get('/dashboard/analytics');
  return res.data;
};

export const createApplication = async (job_id, status = 'Saved', title = null, company = null) => {
  const res = await api.post('/applications/', { job_id, status, title, company });
  return res.data;
};

export const getApplications = async () => {
  const res = await api.get('/applications/');
  return res.data;
};

export const updateApplicationStatus = async (appId, status) => {
  const res = await api.put(`/applications/${appId}/status?status=${encodeURIComponent(status)}`);
  return res.data;
};

export const matchJob = async (job_description, resume_text) => {
  const res = await api.post('/ai/match', { job_description, resume_text });
  return res.data;
};

export const optimizeResume = async (resume_text, target_job_description = '') => {
  const res = await api.post('/ai/resume/optimize', { resume_text, target_job_description });
  return res.data;
};

export const getWorkflowResult = async (jobId) => {
  const res = await api.get(`/ai/workflow/result/${jobId}`);
  return res.data;
};

export const runConnectorAction = async (actionType, company, jobTitle) => {
  const res = await api.post('/ai/action', { action_type: actionType, company, job_title: jobTitle });
  return res.data;
};

export const chatWithJobCoPilot = async (message, history, jobId, extraData = {}) => {
  const res = await api.post('/ai/chat', { 
    message, 
    history, 
    job_id: jobId,
    ...extraData
  });
  return res.data;
};

export const generateMoreInterviewQuestions = async (questionType, jobDescription, company, excludeQuestions = []) => {
  const res = await api.post('/ai/interview/more-questions', {
    question_type: questionType,
    job_description: jobDescription,
    company,
    exclude_questions: excludeQuestions
  });
  return res.data;
};

export const scheduleStudyRoadmap = async (skillName, hours, company, jobTitle) => {
  const res = await api.post('/ai/action/schedule', { skill_name: skillName, hours, company, job_title: jobTitle });
  return res.data;
};

export const syncGoogleTasks = async (title, jobTitle, company) => {
  const res = await api.post('/ai/action/tasks', { title, job_title: jobTitle, company });
  return res.data;
};

export const syncGmailSurface = async () => {
  const res = await api.get('/ai/action/gmail-sync');
  return res.data;
};

export const getConnectorsStatus = async () => {
  const res = await api.get('/ai/connectors/status');
  return res.data;
};

export const connectConnector = async (connectorId) => {
  const res = await api.post('/ai/connectors/connect', { connector_id: connectorId });
  return res.data;
};

export const disconnectConnector = async (connectorId) => {
  const res = await api.post(`/ai/connectors/disconnect?connector_id=${connectorId}`);
  return res.data;
};

export const getAIInsights = async () => {
  const res = await api.get('/dashboard/ai-insights');
  return res.data;
};

// ================= Resume Hub APIs =================
export const getMasterProfile = async () => {
  const res = await api.get('/resume-hub/master-profile');
  return res.data;
};

export const updateMasterProfile = async (profileData) => {
  const res = await api.put('/resume-hub/master-profile', profileData);
  return res.data;
};

export const getResumeVersions = async () => {
  const res = await api.get('/resume-hub/versions');
  return res.data;
};

export const createResumeVersion = async (name, targetRole, template = 'Modern ATS') => {
  const res = await api.post('/resume-hub/versions', { name, target_role: targetRole, template });
  return res.data;
};

export const getResumeVersion = async (id) => {
  const res = await api.get(`/resume-hub/versions/${id}`);
  return res.data;
};

export const updateResumeVersion = async (id, data) => {
  const res = await api.put(`/resume-hub/versions/${id}`, data);
  return res.data;
};

export const deleteResumeVersion = async (id) => {
  const res = await api.delete(`/resume-hub/versions/${id}`);
  return res.data;
};

export const duplicateResumeVersion = async (id) => {
  const res = await api.post(`/resume-hub/versions/${id}/duplicate`);
  return res.data;
};

export const aiGenerateResume = async (targetRole, jobDescription = '') => {
  const res = await api.post('/resume-hub/ai/generate', { target_role: targetRole, job_description: jobDescription });
  return res.data;
};

export const aiScanResume = async (versionId, jobDescription) => {
  const res = await api.post('/resume-hub/ai/scan', { version_id: versionId, job_description: jobDescription });
  return res.data;
};

export const aiSectionAssist = async (sectionType, content, actionType, targetRole = 'Software Engineer') => {
  const res = await api.post('/resume-hub/ai/section-assist', {
    section_type: sectionType,
    content,
    action_type: actionType,
    target_role: targetRole
  });
  return res.data;
};

export default api;
