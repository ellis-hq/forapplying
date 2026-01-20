import React, { useState, useEffect } from 'react';
import {
  X,
  Briefcase,
  BookOpen,
  Heart,
  Check
} from 'lucide-react';
import {
  EmploymentGap,
  EmploymentGapResolutionType,
  ResumeProject,
  ResumeExperience,
  ResumeEducation,
  VolunteerEntry
} from '../types';
import { generateGapCoveringDateRange } from '../utils/employmentGapDetector';

interface GapResolutionFormProps {
  gap: EmploymentGap;
  resolutionType: EmploymentGapResolutionType;
  prefillData?: { title?: string; description?: string };
  onSubmit: (type: EmploymentGapResolutionType, data: ResumeProject | ResumeExperience | ResumeEducation | VolunteerEntry) => void;
  onCancel: () => void;
}

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
];

const GapResolutionForm: React.FC<GapResolutionFormProps> = ({
  gap,
  resolutionType,
  prefillData,
  onSubmit,
  onCancel
}) => {
  const [activeTab, setActiveTab] = useState<EmploymentGapResolutionType>(resolutionType);
  const gapDates = generateGapCoveringDateRange(gap);

  // Generate year options (10 years back from gap end)
  const generateYears = () => {
    const years = [];
    const startYear = gap.startDate.year - 2;
    const endYear = gap.endDate.year + 2;
    for (let year = endYear; year >= startYear; year--) {
      years.push(year.toString());
    }
    return years;
  };

  const years = generateYears();

  // Form states for each type
  const [projectForm, setProjectForm] = useState<{
    name: string;
    description: string;
    technologies: string;
    startMonth: string;
    startYear: string;
    endMonth: string;
    endYear: string;
  }>({
    name: prefillData?.title || '',
    description: prefillData?.description || '',
    technologies: '',
    startMonth: gapDates.startMonth,
    startYear: gapDates.startYear,
    endMonth: gapDates.endMonth,
    endYear: gapDates.endYear
  });

  const [freelanceForm, setFreelanceForm] = useState<{
    role: string;
    company: string;
    location: string;
    bullets: string;
    startMonth: string;
    startYear: string;
    endMonth: string;
    endYear: string;
  }>({
    role: prefillData?.title || '',
    company: '',
    location: '',
    bullets: prefillData?.description || '',
    startMonth: gapDates.startMonth,
    startYear: gapDates.startYear,
    endMonth: gapDates.endMonth,
    endYear: gapDates.endYear
  });

  const [educationForm, setEducationForm] = useState<{
    school: string;
    degree: string;
    fieldOfStudy: string;
    location: string;
    startMonth: string;
    startYear: string;
    endMonth: string;
    endYear: string;
  }>({
    school: prefillData?.title || '',
    degree: '',
    fieldOfStudy: '',
    location: '',
    startMonth: gapDates.startMonth,
    startYear: gapDates.startYear,
    endMonth: gapDates.endMonth,
    endYear: gapDates.endYear
  });

  const [volunteerForm, setVolunteerForm] = useState<{
    organization: string;
    role: string;
    description: string;
    startMonth: string;
    startYear: string;
    endMonth: string;
    endYear: string;
  }>({
    organization: '',
    role: prefillData?.title || '',
    description: prefillData?.description || '',
    startMonth: gapDates.startMonth,
    startYear: gapDates.startYear,
    endMonth: gapDates.endMonth,
    endYear: gapDates.endYear
  });

  // Update prefill when tab changes and we have prefill data
  useEffect(() => {
    if (prefillData?.title) {
      switch (activeTab) {
        case 'project':
          setProjectForm(prev => ({
            ...prev,
            name: prefillData.title || '',
            description: prefillData.description || ''
          }));
          break;
        case 'freelance':
          setFreelanceForm(prev => ({
            ...prev,
            role: prefillData.title || '',
            bullets: prefillData.description || ''
          }));
          break;
        case 'education':
          setEducationForm(prev => ({
            ...prev,
            school: prefillData.title || ''
          }));
          break;
        case 'volunteer':
          setVolunteerForm(prev => ({
            ...prev,
            role: prefillData.title || '',
            description: prefillData.description || ''
          }));
          break;
      }
    }
  }, [activeTab, prefillData]);

  const formatDateRange = (startMonth: string, startYear: string, endMonth: string, endYear: string): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(startMonth) - 1]} ${startYear} - ${months[parseInt(endMonth) - 1]} ${endYear}`;
  };

  const handleSubmit = () => {
    switch (activeTab) {
      case 'project':
        const project: ResumeProject = {
          name: projectForm.name,
          dateRange: formatDateRange(projectForm.startMonth, projectForm.startYear, projectForm.endMonth, projectForm.endYear),
          description: projectForm.description,
          technologies: projectForm.technologies
        };
        onSubmit('project', project);
        break;

      case 'freelance':
        const experience: ResumeExperience = {
          company: freelanceForm.company || 'Freelance / Contract',
          role: freelanceForm.role,
          location: freelanceForm.location || 'Remote',
          dateRange: formatDateRange(freelanceForm.startMonth, freelanceForm.startYear, freelanceForm.endMonth, freelanceForm.endYear),
          startMonth: freelanceForm.startMonth,
          startYear: freelanceForm.startYear,
          endMonth: freelanceForm.endMonth,
          endYear: freelanceForm.endYear,
          bullets: freelanceForm.bullets.split('\n').filter(b => b.trim())
        };
        onSubmit('freelance', experience);
        break;

      case 'education':
        const education: ResumeEducation = {
          school: educationForm.school,
          degree: educationForm.degree,
          fieldOfStudy: educationForm.fieldOfStudy,
          location: educationForm.location || 'Online',
          dateRange: formatDateRange(educationForm.startMonth, educationForm.startYear, educationForm.endMonth, educationForm.endYear),
          startMonth: educationForm.startMonth,
          startYear: educationForm.startYear,
          endMonth: educationForm.endMonth,
          endYear: educationForm.endYear
        };
        onSubmit('education', education);
        break;

      case 'volunteer':
        const volunteer: VolunteerEntry = {
          organization: volunteerForm.organization,
          role: volunteerForm.role,
          dateRange: formatDateRange(volunteerForm.startMonth, volunteerForm.startYear, volunteerForm.endMonth, volunteerForm.endYear),
          description: volunteerForm.description
        };
        onSubmit('volunteer', volunteer);
        break;
    }
  };

  const isFormValid = (): boolean => {
    switch (activeTab) {
      case 'project':
        return !!(projectForm.name && projectForm.description);
      case 'freelance':
        return !!(freelanceForm.role && freelanceForm.bullets);
      case 'education':
        return !!(educationForm.school && educationForm.degree);
      case 'volunteer':
        return !!(volunteerForm.organization && volunteerForm.role);
      default:
        return false;
    }
  };

  const tabs = [
    { id: 'project' as const, label: 'Project', icon: Briefcase },
    { id: 'freelance' as const, label: 'Freelance', icon: Briefcase },
    { id: 'education' as const, label: 'Education', icon: BookOpen },
    { id: 'volunteer' as const, label: 'Volunteer', icon: Heart }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Address Employment Gap</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {gap.previousJob.endDate} — {gap.nextJob.startDate}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-border-light text-text-muted hover:text-text-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-border bg-border-light/50">
          <div className="flex gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:bg-border-light'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Project Form */}
          {activeTab === 'project' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Personal Finance Tracker App"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Start Date
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={projectForm.startMonth}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, startMonth: e.target.value }))}
                      className="flex-1 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {MONTHS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={projectForm.startYear}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, startYear: e.target.value }))}
                      className="w-24 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    End Date
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={projectForm.endMonth}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, endMonth: e.target.value }))}
                      className="flex-1 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {MONTHS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={projectForm.endYear}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, endYear: e.target.value }))}
                      className="w-24 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Description *
                </label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what you built and what you learned..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Technologies Used
                </label>
                <input
                  type="text"
                  value={projectForm.technologies}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, technologies: e.target.value }))}
                  placeholder="e.g., React, Node.js, PostgreSQL"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Freelance Form */}
          {activeTab === 'freelance' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Role / Title *
                </label>
                <input
                  type="text"
                  value={freelanceForm.role}
                  onChange={(e) => setFreelanceForm(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g., Freelance Web Developer"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Company / Client (optional)
                  </label>
                  <input
                    type="text"
                    value={freelanceForm.company}
                    onChange={(e) => setFreelanceForm(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Self-employed or client name"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Location
                  </label>
                  <input
                    type="text"
                    value={freelanceForm.location}
                    onChange={(e) => setFreelanceForm(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Remote"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Start Date
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={freelanceForm.startMonth}
                      onChange={(e) => setFreelanceForm(prev => ({ ...prev, startMonth: e.target.value }))}
                      className="flex-1 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {MONTHS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={freelanceForm.startYear}
                      onChange={(e) => setFreelanceForm(prev => ({ ...prev, startYear: e.target.value }))}
                      className="w-24 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    End Date
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={freelanceForm.endMonth}
                      onChange={(e) => setFreelanceForm(prev => ({ ...prev, endMonth: e.target.value }))}
                      className="flex-1 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {MONTHS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={freelanceForm.endYear}
                      onChange={(e) => setFreelanceForm(prev => ({ ...prev, endYear: e.target.value }))}
                      className="w-24 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Accomplishments * (one per line)
                </label>
                <textarea
                  value={freelanceForm.bullets}
                  onChange={(e) => setFreelanceForm(prev => ({ ...prev, bullets: e.target.value }))}
                  placeholder="Describe your freelance work and achievements..."
                  rows={4}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}

          {/* Education Form */}
          {activeTab === 'education' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  School / Institution *
                </label>
                <input
                  type="text"
                  value={educationForm.school}
                  onChange={(e) => setEducationForm(prev => ({ ...prev, school: e.target.value }))}
                  placeholder="e.g., Coursera, Udemy, Local Community College"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Degree / Certificate *
                  </label>
                  <input
                    type="text"
                    value={educationForm.degree}
                    onChange={(e) => setEducationForm(prev => ({ ...prev, degree: e.target.value }))}
                    placeholder="e.g., Professional Certificate"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Field of Study
                  </label>
                  <input
                    type="text"
                    value={educationForm.fieldOfStudy}
                    onChange={(e) => setEducationForm(prev => ({ ...prev, fieldOfStudy: e.target.value }))}
                    placeholder="e.g., Data Science"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  value={educationForm.location}
                  onChange={(e) => setEducationForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., Online"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Start Date
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={educationForm.startMonth}
                      onChange={(e) => setEducationForm(prev => ({ ...prev, startMonth: e.target.value }))}
                      className="flex-1 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {MONTHS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={educationForm.startYear}
                      onChange={(e) => setEducationForm(prev => ({ ...prev, startYear: e.target.value }))}
                      className="w-24 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    End Date
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={educationForm.endMonth}
                      onChange={(e) => setEducationForm(prev => ({ ...prev, endMonth: e.target.value }))}
                      className="flex-1 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {MONTHS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={educationForm.endYear}
                      onChange={(e) => setEducationForm(prev => ({ ...prev, endYear: e.target.value }))}
                      className="w-24 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Volunteer Form */}
          {activeTab === 'volunteer' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Organization *
                </label>
                <input
                  type="text"
                  value={volunteerForm.organization}
                  onChange={(e) => setVolunteerForm(prev => ({ ...prev, organization: e.target.value }))}
                  placeholder="e.g., Local Food Bank, Habitat for Humanity"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Role *
                </label>
                <input
                  type="text"
                  value={volunteerForm.role}
                  onChange={(e) => setVolunteerForm(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g., Volunteer Coordinator, Website Developer"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Start Date
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={volunteerForm.startMonth}
                      onChange={(e) => setVolunteerForm(prev => ({ ...prev, startMonth: e.target.value }))}
                      className="flex-1 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {MONTHS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={volunteerForm.startYear}
                      onChange={(e) => setVolunteerForm(prev => ({ ...prev, startYear: e.target.value }))}
                      className="w-24 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    End Date
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={volunteerForm.endMonth}
                      onChange={(e) => setVolunteerForm(prev => ({ ...prev, endMonth: e.target.value }))}
                      className="flex-1 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {MONTHS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={volunteerForm.endYear}
                      onChange={(e) => setVolunteerForm(prev => ({ ...prev, endYear: e.target.value }))}
                      className="w-24 px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Description
                </label>
                <textarea
                  value={volunteerForm.description}
                  onChange={(e) => setVolunteerForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your volunteer work and impact..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-border-light/50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-border text-text-secondary hover:bg-border-light rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid()}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-border text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Check className="w-4 h-4" />
            Add to Resume
          </button>
        </div>
      </div>
    </div>
  );
};

export default GapResolutionForm;
