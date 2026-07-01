import React, { useState } from 'react';
import { User, FileText, Briefcase, Code, GraduationCap, Award, Link2, Plus, Trash2, Save, Loader2, ArrowUp, ArrowDown, UploadCloud, Check } from 'lucide-react';

export default function MasterProfileView({ initialProfile, onSave }) {
  const [profile, setProfile] = useState(initialProfile || {
    personal_info: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', portfolio: '', website: '' },
    professional_summary: '',
    education: [],
    experience: [],
    projects: [],
    skills: [],
    certifications: []
  });
  
  const [activeTab, setActiveTab] = useState('personal');
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(profile);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/resume-hub/master-profile/upload-resume', {
        method: 'POST',
        body: formData,
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Upload error:', responseData);
        throw new Error(responseData.detail || 'Failed to upload resume');
      }

      const parsedData = responseData;
      
      // Merge parsed data with existing profile
      setProfile(prev => ({
        ...prev,
        personal_info: {
          ...prev.personal_info,
          ...parsedData.personal_info
        },
        professional_summary: parsedData.professional_summary || prev.professional_summary,
        education: parsedData.education || prev.education,
        experience: parsedData.experience || prev.experience,
        projects: parsedData.projects || prev.projects,
        skills: parsedData.skills || prev.skills,
        certifications: parsedData.certifications || prev.certifications
      }));

      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (error) {
      console.error('Resume upload failed:', error);
      alert(`Failed to parse resume: ${error.message}. Please try manual entry or check the file format (PDF, DOCX, TXT only).`);
    } finally {
      setUploading(false);
    }
  };

  // Helper for input updates
  const updatePersonalInfo = (field, val) => {
    setProfile(prev => ({
      ...prev,
      personal_info: {
        ...(prev.personal_info || {}),
        [field]: val
      }
    }));
  };

  // Helper to reorder arrays
  const moveItem = (listKey, index, direction) => {
    const list = [...(profile[listKey] || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= list.length) return;
    
    const temp = list[index];
    list[index] = list[newIndex];
    list[newIndex] = temp;
    
    setProfile(prev => ({ ...prev, [listKey]: list }));
  };

  // --- Experience Handlers ---
  const addExperience = () => {
    const newItem = { id: 'exp-' + Date.now(), company: '', role: '', location: '', start_date: '', end_date: '', description: [''], is_current: false };
    setProfile(prev => ({ ...prev, experience: [...(prev.experience || []), newItem] }));
  };
  const removeExperience = (idx) => {
    setProfile(prev => ({ ...prev, experience: prev.experience.filter((_, i) => i !== idx) }));
  };
  const updateExperience = (idx, field, val) => {
    const list = [...(profile.experience || [])];
    list[idx][field] = val;
    setProfile(prev => ({ ...prev, experience: list }));
  };
  const addExpBullet = (expIdx) => {
    const list = [...(profile.experience || [])];
    list[expIdx].description = [...(list[expIdx].description || []), ''];
    setProfile(prev => ({ ...prev, experience: list }));
  };
  const updateExpBullet = (expIdx, bulletIdx, val) => {
    const list = [...(profile.experience || [])];
    list[expIdx].description[bulletIdx] = val;
    setProfile(prev => ({ ...prev, experience: list }));
  };
  const removeExpBullet = (expIdx, bulletIdx) => {
    const list = [...(profile.experience || [])];
    list[expIdx].description = list[expIdx].description.filter((_, i) => i !== bulletIdx);
    setProfile(prev => ({ ...prev, experience: list }));
  };

  // --- Project Handlers ---
  const addProject = () => {
    const newItem = { id: 'proj-' + Date.now(), name: '', technologies: [], description: [''], link: '' };
    setProfile(prev => ({ ...prev, projects: [...(prev.projects || []), newItem] }));
  };
  const removeProject = (idx) => {
    setProfile(prev => ({ ...prev, projects: prev.projects.filter((_, i) => i !== idx) }));
  };
  const updateProject = (idx, field, val) => {
    const list = [...(profile.projects || [])];
    if (field === 'technologies') {
      list[idx][field] = val.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      list[idx][field] = val;
    }
    setProfile(prev => ({ ...prev, projects: list }));
  };
  const addProjBullet = (projIdx) => {
    const list = [...(profile.projects || [])];
    list[projIdx].description = [...(list[projIdx].description || []), ''];
    setProfile(prev => ({ ...prev, projects: list }));
  };
  const updateProjBullet = (projIdx, bulletIdx, val) => {
    const list = [...(profile.projects || [])];
    list[projIdx].description[bulletIdx] = val;
    setProfile(prev => ({ ...prev, projects: list }));
  };
  const removeProjBullet = (projIdx, bulletIdx) => {
    const list = [...(profile.projects || [])];
    list[projIdx].description = list[projIdx].description.filter((_, i) => i !== bulletIdx);
    setProfile(prev => ({ ...prev, projects: list }));
  };

  // --- Education Handlers ---
  const addEducation = () => {
    const newItem = { id: 'edu-' + Date.now(), institution: '', degree: '', field_of_study: '', start_date: '', end_date: '', grade: '' };
    setProfile(prev => ({ ...prev, education: [...(prev.education || []), newItem] }));
  };
  const removeEducation = (idx) => {
    setProfile(prev => ({ ...prev, education: prev.education.filter((_, i) => i !== idx) }));
  };
  const updateEducation = (idx, field, val) => {
    const list = [...(profile.education || [])];
    list[idx][field] = val;
    setProfile(prev => ({ ...prev, education: list }));
  };

  // --- Certification Handlers ---
  const addCertification = () => {
    const newItem = { id: 'cert-' + Date.now(), name: '', issuer: '', date: '', link: '' };
    setProfile(prev => ({ ...prev, certifications: [...(prev.certifications || []), newItem] }));
  };
  const removeCertification = (idx) => {
    setProfile(prev => ({ ...prev, certifications: prev.certifications.filter((_, i) => i !== idx) }));
  };
  const updateCertification = (idx, field, val) => {
    const list = [...(profile.certifications || [])];
    list[idx][field] = val;
    setProfile(prev => ({ ...prev, certifications: list }));
  };

  // --- Skills Handlers ---
  const handleAddSkill = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();
      if (!newSkill.trim() || (profile.skills || []).includes(newSkill.trim())) return;
      setProfile(prev => ({ ...prev, skills: [...(prev.skills || []), newSkill.trim()] }));
      setNewSkill('');
    }
  };
  const removeSkill = (skill) => {
    setProfile(prev => ({ ...prev, skills: (prev.skills || []).filter(s => s !== skill) }));
  };

  const tabs = [
    { id: 'personal', name: 'Personal Details', icon: User },
    { id: 'summary', name: 'Summary', icon: FileText },
    { id: 'experience', name: 'Work Experience', icon: Briefcase },
    { id: 'projects', name: 'Projects', icon: Code },
    { id: 'education', name: 'Education', icon: GraduationCap },
    { id: 'skills', name: 'Skills & Certs', icon: Award }
  ];

  const personalInfo = profile.personal_info || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Tabs Menu Sidebar */}
      <div className="lg:col-span-1 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-2 bg-slate-900/60 border border-slate-800/85 p-3 rounded-2xl shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                isActive
                  ? 'bg-teal-500/10 border border-teal-500/20 text-teal-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon size={14} />
              <span>{tab.name}</span>
            </button>
          );
        })}

        <div className="hidden lg:block border-t border-slate-800/80 my-4" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-xs py-2 px-3 flex justify-center items-center gap-1.5 w-full shrink-0"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* Profile Form Details */}
      <div className="lg:col-span-3 card min-h-[500px] flex flex-col justify-between">
        <div className="space-y-6">
          {/* PERSONAL DETAILS TAB */}
          {activeTab === 'personal' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-slate-200">Personal Information</h3>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-[10px] text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded px-3 py-1.5 cursor-pointer hover:bg-teal-500/15 transition-colors">
                    <UploadCloud size={12} />
                    <span>{uploading ? 'Uploading...' : 'Upload Resume'}</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={handleResumeUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                  {uploadSuccess && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <Check size={12} />
                      Parsed!
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-slate-500">Upload your existing resume (PDF, DOCX, or TXT) to auto-fill your profile using AI.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Full Name</label>
                  <input type="text" className="input-field py-2 px-3 text-xs" value={personalInfo.name || ''} onChange={(e) => updatePersonalInfo('name', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Email Address</label>
                  <input type="email" className="input-field py-2 px-3 text-xs" value={personalInfo.email || ''} onChange={(e) => updatePersonalInfo('email', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Phone Number</label>
                  <input type="text" className="input-field py-2 px-3 text-xs" value={personalInfo.phone || ''} onChange={(e) => updatePersonalInfo('phone', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Location (e.g. City, Country)</label>
                  <input type="text" className="input-field py-2 px-3 text-xs" value={personalInfo.location || ''} onChange={(e) => updatePersonalInfo('location', e.target.value)} />
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 pt-4">Social Links</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">LinkedIn URL</label>
                  <input type="text" className="input-field py-2 px-3 text-xs" value={personalInfo.linkedin || ''} onChange={(e) => updatePersonalInfo('linkedin', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">GitHub URL</label>
                  <input type="text" className="input-field py-2 px-3 text-xs" value={personalInfo.github || ''} onChange={(e) => updatePersonalInfo('github', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Portfolio Link</label>
                  <input type="text" className="input-field py-2 px-3 text-xs" value={personalInfo.portfolio || ''} onChange={(e) => updatePersonalInfo('portfolio', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Website URL</label>
                  <input type="text" className="input-field py-2 px-3 text-xs" value={personalInfo.website || ''} onChange={(e) => updatePersonalInfo('website', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* SUMMARY TAB */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">Professional Summary</h3>
              <p className="text-[11px] text-slate-500">Provide a summary of your career accomplishments and tech skills. This acts as the baseline for AI generation.</p>
              <textarea
                className="input-field min-h-[250px] text-xs font-sans leading-relaxed"
                placeholder="Write your baseline career statement..."
                value={profile.professional_summary || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, professional_summary: e.target.value }))}
              />
            </div>
          )}

          {/* WORK EXPERIENCE TAB */}
          {activeTab === 'experience' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-slate-200">Work Experience History</h3>
                <button type="button" onClick={addExperience} className="flex items-center gap-1 text-[10px] text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded px-2.5 py-1">
                  <Plus size={11} /> Add Experience
                </button>
              </div>

              {(profile.experience || []).length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                  No experience items added. Click the button above to add details.
                </div>
              ) : (
                <div className="space-y-6">
                  {profile.experience.map((exp, expIdx) => (
                    <div key={exp.id ?? expIdx} className="bg-slate-950/40 p-4 border border-slate-800/80 rounded-xl space-y-4 relative">
                      {/* Controls header */}
                      <div className="absolute right-3 top-3 flex gap-1">
                        <button type="button" onClick={() => moveItem('experience', expIdx, 'up')} disabled={expIdx === 0} className="p-1 hover:text-teal-400 disabled:opacity-30"><ArrowUp size={12} /></button>
                        <button type="button" onClick={() => moveItem('experience', expIdx, 'down')} disabled={expIdx === profile.experience.length - 1} className="p-1 hover:text-teal-400 disabled:opacity-30"><ArrowDown size={12} /></button>
                        <button type="button" onClick={() => removeExperience(expIdx)} className="p-1 text-rose-400 hover:text-rose-300"><Trash2 size={12} /></button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 sm:pt-0">
                        <div className="md:col-span-2">
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Company</label>
                          <input type="text" className="input-field py-1.5 px-2.5 text-xs" value={exp.company} onChange={(e) => updateExperience(expIdx, 'company', e.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Role/Title</label>
                          <input type="text" className="input-field py-1.5 px-2.5 text-xs" value={exp.role} onChange={(e) => updateExperience(expIdx, 'role', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Start Date</label>
                          <input type="text" placeholder="e.g. Feb 2026" className="input-field py-1.5 px-2.5 text-xs" value={exp.start_date || ''} onChange={(e) => updateExperience(expIdx, 'start_date', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">End Date</label>
                          <input type="text" placeholder="e.g. Present" className="input-field py-1.5 px-2.5 text-xs" value={exp.end_date || ''} onChange={(e) => updateExperience(expIdx, 'end_date', e.target.value)} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Location</label>
                          <input type="text" placeholder="e.g. Remote / City, ST" className="input-field py-1.5 px-2.5 text-xs" value={exp.location || ''} onChange={(e) => updateExperience(expIdx, 'location', e.target.value)} />
                        </div>
                      </div>

                      {/* Bullet list description */}
                      <div className="space-y-2 pt-2 border-t border-slate-900">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] text-slate-500 font-bold">Bullet Descriptions</label>
                          <button type="button" onClick={() => addExpBullet(expIdx)} className="text-[9px] text-teal-400 flex items-center gap-0.5 hover:text-teal-300">
                            <Plus size={10} /> Add Bullet
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {(exp.description || []).map((bullet, bIdx) => (
                            <div key={bIdx} className="flex gap-2">
                              <input type="text" className="input-field py-1 px-2.5 text-xs flex-1" value={bullet} onChange={(e) => updateExpBullet(expIdx, bIdx, e.target.value)} />
                              <button type="button" onClick={() => removeExpBullet(expIdx, bIdx)} className="p-1.5 text-rose-500 hover:text-rose-400 shrink-0"><Trash2 size={11} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PROJECTS TAB */}
          {activeTab === 'projects' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-slate-200">Personal & Professional Projects</h3>
                <button type="button" onClick={addProject} className="flex items-center gap-1 text-[10px] text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded px-2.5 py-1">
                  <Plus size={11} /> Add Project
                </button>
              </div>

              {(profile.projects || []).length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                  No projects added. Click the button above to add details.
                </div>
              ) : (
                <div className="space-y-6">
                  {profile.projects.map((proj, projIdx) => (
                    <div key={proj.id ?? projIdx} className="bg-slate-950/40 p-4 border border-slate-800/80 rounded-xl space-y-4 relative">
                      {/* Controls header */}
                      <div className="absolute right-3 top-3 flex gap-1">
                        <button type="button" onClick={() => moveItem('projects', projIdx, 'up')} disabled={projIdx === 0} className="p-1 hover:text-teal-400 disabled:opacity-30"><ArrowUp size={12} /></button>
                        <button type="button" onClick={() => moveItem('projects', projIdx, 'down')} disabled={projIdx === profile.projects.length - 1} className="p-1 hover:text-teal-400 disabled:opacity-30"><ArrowDown size={12} /></button>
                        <button type="button" onClick={() => removeProject(projIdx)} className="p-1 text-rose-400 hover:text-rose-300"><Trash2 size={12} /></button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-4 sm:pt-0">
                        <div className="md:col-span-2">
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Project Name</label>
                          <input type="text" className="input-field py-1.5 px-2.5 text-xs" value={proj.name} onChange={(e) => updateProject(projIdx, 'name', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Project Link</label>
                          <input type="text" placeholder="e.g. github.com/..." className="input-field py-1.5 px-2.5 text-xs" value={proj.link || ''} onChange={(e) => updateProject(projIdx, 'link', e.target.value)} />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Technologies Used (Comma-separated)</label>
                          <input type="text" placeholder="e.g. React, Node.js, AWS" className="input-field py-1.5 px-2.5 text-xs" value={(proj.technologies || []).join(', ')} onChange={(e) => updateProject(projIdx, 'technologies', e.target.value)} />
                        </div>
                      </div>

                      {/* Project bullet descriptions */}
                      <div className="space-y-2 pt-2 border-t border-slate-900">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] text-slate-500 font-bold">Project Details / Highlights</label>
                          <button type="button" onClick={() => addProjBullet(projIdx)} className="text-[9px] text-teal-400 flex items-center gap-0.5 hover:text-teal-300">
                            <Plus size={10} /> Add Bullet
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {(proj.description || []).map((bullet, bIdx) => (
                            <div key={bIdx} className="flex gap-2">
                              <input type="text" className="input-field py-1 px-2.5 text-xs flex-1" value={bullet} onChange={(e) => updateProjBullet(projIdx, bIdx, e.target.value)} />
                              <button type="button" onClick={() => removeProjBullet(projIdx, bIdx)} className="p-1.5 text-rose-500 hover:text-rose-400 shrink-0"><Trash2 size={11} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EDUCATION TAB */}
          {activeTab === 'education' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-slate-200">Education Details</h3>
                <button type="button" onClick={addEducation} className="flex items-center gap-1 text-[10px] text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded px-2.5 py-1">
                  <Plus size={11} /> Add Education
                </button>
              </div>

              {(profile.education || []).length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                  No education history added. Click the button above to add details.
                </div>
              ) : (
                <div className="space-y-4">
                  {profile.education.map((edu, eduIdx) => (
                    <div key={edu.id ?? eduIdx} className="bg-slate-950/40 p-4 border border-slate-800/80 rounded-xl space-y-4 relative">
                      <div className="absolute right-3 top-3 flex gap-1">
                        <button type="button" onClick={() => removeEducation(eduIdx)} className="p-1 text-rose-400 hover:text-rose-300"><Trash2 size={12} /></button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-4 sm:pt-0">
                        <div className="md:col-span-2">
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Institution / University</label>
                          <input type="text" className="input-field py-1.5 px-2.5 text-xs" value={edu.institution} onChange={(e) => updateEducation(eduIdx, 'institution', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Degree</label>
                          <input type="text" placeholder="e.g. B.Tech" className="input-field py-1.5 px-2.5 text-xs" value={edu.degree} onChange={(e) => updateEducation(eduIdx, 'degree', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Field of Study</label>
                          <input type="text" placeholder="e.g. Computer Science" className="input-field py-1.5 px-2.5 text-xs" value={edu.field_of_study || ''} onChange={(e) => updateEducation(eduIdx, 'field_of_study', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Start Date</label>
                          <input type="text" placeholder="e.g. Sept 2023" className="input-field py-1.5 px-2.5 text-xs" value={edu.start_date || ''} onChange={(e) => updateEducation(eduIdx, 'start_date', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">End Date</label>
                          <input type="text" placeholder="e.g. May 2027" className="input-field py-1.5 px-2.5 text-xs" value={edu.end_date || ''} onChange={(e) => updateEducation(eduIdx, 'end_date', e.target.value)} />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Grade / CGPA</label>
                          <input type="text" placeholder="e.g. 8.53/10 or GPA 3.8" className="input-field py-1.5 px-2.5 text-xs" value={edu.grade || ''} onChange={(e) => updateEducation(eduIdx, 'grade', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SKILLS & CERTS TAB */}
          {activeTab === 'skills' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">Skills Inventory</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type a skill and press Enter (e.g. Python, Docker)"
                    className="input-field py-2 px-3 text-xs flex-grow"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={handleAddSkill}
                  />
                  <button type="button" onClick={handleAddSkill} className="btn-secondary text-xs px-4">
                    Add
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-1.5 mt-2 bg-slate-950/40 p-3.5 border border-slate-850 rounded-xl min-h-[100px]">
                  {(profile.skills || []).length === 0 ? (
                    <span className="text-xs text-slate-500 italic">No skills listed yet. Add tags above.</span>
                  ) : (
                    profile.skills.map((skill, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs px-2.5 py-1 rounded-lg">
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)} className="text-[9px] font-bold text-teal-500 hover:text-rose-400 ml-1">×</button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-900">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-slate-200">Certifications & Licenses</h3>
                  <button type="button" onClick={addCertification} className="flex items-center gap-1 text-[10px] text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded px-2.5 py-1">
                    <Plus size={11} /> Add Certification
                  </button>
                </div>

                {(profile.certifications || []).length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                    No certifications added. Click the button above to add details.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {profile.certifications.map((cert, certIdx) => (
                      <div key={cert.id ?? certIdx} className="bg-slate-950/40 p-3 border border-slate-800/80 rounded-xl relative space-y-3">
                        <div className="absolute right-3 top-3">
                          <button type="button" onClick={() => removeCertification(certIdx)} className="p-1 text-rose-400 hover:text-rose-350"><Trash2 size={12} /></button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 sm:pt-0">
                          <div className="md:col-span-2">
                            <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Cert Name</label>
                            <input type="text" className="input-field py-1.5 px-2.5 text-xs" value={cert.name} onChange={(e) => updateCertification(certIdx, 'name', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Issuer</label>
                            <input type="text" className="input-field py-1.5 px-2.5 text-xs" value={cert.issuer} onChange={(e) => updateCertification(certIdx, 'issuer', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Date Earned</label>
                            <input type="text" placeholder="e.g. Jan 2026" className="input-field py-1.5 px-2.5 text-xs" value={cert.date || ''} onChange={(e) => updateCertification(certIdx, 'date', e.target.value)} />
                          </div>
                          <div className="sm:col-span-4">
                            <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Credential Link</label>
                            <input type="text" className="input-field py-1.5 px-2.5 text-xs" value={cert.link || ''} onChange={(e) => updateCertification(certIdx, 'link', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sync trigger at bottom for responsiveness */}
        <div className="flex lg:hidden border-t border-slate-900 pt-4 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-xs py-2.5 px-4 flex justify-center items-center gap-1.5 w-full"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
