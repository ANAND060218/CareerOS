import axios from 'axios';

const api = axios.create({
    baseURL: '',
});

export const getJobs = async (company = '') => {
    const res = await api.get(`/jobs/?company=${company}`);
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

export const matchJob = async (job_description, resume_text) => {
    const res = await api.post('/ai/match', { job_description, resume_text });
    return res.data;
};

export const optimizeResume = async (resume_text, target_job_description = '') => {
    const res = await api.post('/ai/resume/optimize', { resume_text, target_job_description });
    return res.data;
};

export const saveResumeMemory = async (resume_text) => {
    const res = await api.post('/memory/', { resume_text });
    return res.data;
};

export const runLemmaWorkflow = async (resume_text, job_description, company = '') => {
    const res = await api.post('/ai/workflow', { resume_text, job_description, company });
    return res.data;
};

export const createApplication = async (job_id, status = 'Saved') => {
    const res = await api.post('/applications/', { job_id, status });
    return res.data;
};

export const getApplications = async () => {
    const res = await api.get('/applications/');
    return res.data;
};
