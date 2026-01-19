import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { TailoredResumeData, ResumeExperience, ResumeEducation, EditableResumeData, ResumeStyle } from '../types';

// Set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Extracts raw text from a PDF file using pdf.js
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: unknown) => {
        const textItem = item as { str?: string };
        return textItem.str || '';
      })
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Styling Constants
 */
const CONFIG = {
  margin: 54, // ~0.75 inch
  font: 'helvetica',
  colors: {
    primary: [0, 0, 0] as [number, number, number],
    secondary: [70, 70, 70] as [number, number, number],
  },
  sizes: {
    name: 18,
    contact: 9,
    sectionHeader: 11,
    body: 10,
  },
  spacing: {
    section: 18,
    role: 12,
    bullet: 4,
    afterHeader: 10,
  }
};

type PDFBuilder = {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  cursorY: number;
  ensureSpace: (needed: number) => void;
  writeParagraph: (text: string, size: number, style?: string, color?: [number, number, number], align?: 'left' | 'center' | 'right', indent?: number) => void;
  writeBullet: (text: string) => void;
  renderSectionHeader: (title: string) => void;
};

const createBuilder = (doc: jsPDF): PDFBuilder => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - (CONFIG.margin * 2);
  let cursorY = CONFIG.margin;

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageHeight - CONFIG.margin) {
      doc.addPage();
      cursorY = CONFIG.margin;
    }
  };

  const writeParagraph = (text: string, size: number, style: string = 'normal', color = CONFIG.colors.primary, align: 'left' | 'center' | 'right' = 'left', _indent = 0) => {
    doc.setFont(CONFIG.font, style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    
    const lines: string[] = doc.splitTextToSize(text, contentWidth - _indent);
    const xPos = align === 'center' ? pageWidth / 2 : align === 'right' ? pageWidth - CONFIG.margin : CONFIG.margin + _indent;
    
    doc.text(lines, xPos, cursorY, { align });
    cursorY += (lines.length * size * 1.2);
  };

  const writeBullet = (text: string) => {
    const bulletSymbol = '•';
    const bulletSize = CONFIG.sizes.body;
    const indentWidth = 12;

    doc.setFont(CONFIG.font, 'normal');
    doc.setFontSize(bulletSize);
    doc.setTextColor(CONFIG.colors.primary[0], CONFIG.colors.primary[1], CONFIG.colors.primary[2]);

    const lines: string[] = doc.splitTextToSize(text, contentWidth - indentWidth);
    const totalHeight = lines.length * bulletSize * 1.3;
    ensureSpace(totalHeight);

    doc.text(bulletSymbol, CONFIG.margin, cursorY);
    doc.text(lines, CONFIG.margin + indentWidth, cursorY);
    
    cursorY += totalHeight + CONFIG.spacing.bullet;
  };

  const renderSectionHeader = (title: string) => {
    ensureSpace(40);
    doc.setFont(CONFIG.font, 'bold');
    doc.setFontSize(CONFIG.sizes.sectionHeader);
    doc.setTextColor(0, 0, 0);
    doc.text(title.toUpperCase(), CONFIG.margin, cursorY);
    
    cursorY += 4;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(CONFIG.margin, cursorY, pageWidth - CONFIG.margin, cursorY);
    
    cursorY += CONFIG.spacing.afterHeader;
  };

  return { 
    doc, 
    pageWidth, 
    pageHeight, 
    contentWidth, 
    get cursorY() { return cursorY; },
    set cursorY(val: number) { cursorY = val; },
    ensureSpace, 
    writeParagraph, 
    writeBullet, 
    renderSectionHeader 
  };
};

const renderHeader = (b: PDFBuilder, contact: TailoredResumeData['contact'], jobTitle?: string) => {
  b.writeParagraph(contact.name.toUpperCase(), CONFIG.sizes.name, 'bold', CONFIG.colors.primary, 'center');

  // Add job title if provided
  if (jobTitle && jobTitle.trim()) {
    b.cursorY += 2;
    b.writeParagraph(jobTitle, CONFIG.sizes.sectionHeader, 'normal', CONFIG.colors.secondary, 'center');
  }

  b.cursorY += 2;

  const contactParts = [contact.email, contact.phone, contact.location, contact.linkedin].filter(Boolean);
  b.writeParagraph(contactParts.join('  •  '), CONFIG.sizes.contact, 'normal', CONFIG.colors.secondary, 'center');
  b.cursorY += CONFIG.spacing.section;
};

const renderSummary = (b: PDFBuilder, summary: string) => {
  b.renderSectionHeader('Professional Summary');
  b.writeParagraph(summary, CONFIG.sizes.body);
  b.cursorY += CONFIG.spacing.section;
};

const renderSkills = (b: PDFBuilder, skills: TailoredResumeData['skills']) => {
  b.renderSectionHeader('Skills & Tools');
  if (skills.tools.length > 0) {
    b.writeParagraph(`Tools: ${skills.tools.join(', ')}`, CONFIG.sizes.body);
    b.cursorY += 2;
  }
  if (skills.core.length > 0) {
    b.writeParagraph(`Core Skills: ${skills.core.join(', ')}`, CONFIG.sizes.body);
  }
  b.cursorY += CONFIG.spacing.section;
};

const renderExperience = (b: PDFBuilder, experience: ResumeExperience[]) => {
  b.renderSectionHeader('Professional Experience');
  experience.forEach((exp, idx) => {
    b.ensureSpace(60);

    b.doc.setFont(CONFIG.font, 'bold');
    b.doc.setFontSize(CONFIG.sizes.body);
    b.doc.text(exp.role, CONFIG.margin, b.cursorY);
    const dateWidth = b.doc.getTextWidth(exp.dateRange);
    b.doc.text(exp.dateRange, b.pageWidth - CONFIG.margin - dateWidth, b.cursorY);
    b.cursorY += 13;

    b.doc.setFont(CONFIG.font, 'normal');
    b.doc.text(exp.company, CONFIG.margin, b.cursorY);
    b.doc.setFont(CONFIG.font, 'italic');
    const locWidth = b.doc.getTextWidth(exp.location || '');
    if (exp.location) {
      b.doc.text(exp.location, b.pageWidth - CONFIG.margin - locWidth, b.cursorY);
    }
    b.cursorY += 15;

    exp.bullets.forEach(bullet => b.writeBullet(bullet));

    b.cursorY += (idx === experience.length - 1) ? 0 : CONFIG.spacing.role;
  });
  b.cursorY += CONFIG.spacing.section;
};

const renderEducation = (b: PDFBuilder, education: ResumeEducation[]) => {
  b.renderSectionHeader('Education');
  education.forEach(edu => {
    b.ensureSpace(30);
    b.doc.setFont(CONFIG.font, 'bold');
    b.doc.setFontSize(CONFIG.sizes.body);
    b.doc.text(edu.degree, CONFIG.margin, b.cursorY);
    const dateWidth = b.doc.getTextWidth(edu.dateRange);
    b.doc.text(edu.dateRange, b.pageWidth - CONFIG.margin - dateWidth, b.cursorY);
    b.cursorY += 13;

    b.doc.setFont(CONFIG.font, 'normal');
    const eduLocation = edu.location ? ` – ${edu.location}` : '';
    b.doc.text(`${edu.school}${eduLocation}`, CONFIG.margin, b.cursorY);
    b.cursorY += 20;
  });
  b.cursorY += CONFIG.spacing.section;
};

/**
 * Generates an aesthetic, ATS-friendly PDF using a flow-layout logic
 * Supports different section orderings based on resume style
 */
export function generateATSPDF(data: TailoredResumeData | EditableResumeData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const builder = createBuilder(doc);

  // Check if data has jobTitle and resumeStyle (EditableResumeData)
  const jobTitle = 'jobTitle' in data ? data.jobTitle : undefined;
  const style = 'resumeStyle' in data ? data.resumeStyle : ResumeStyle.CLASSIC;

  // Always render header first
  renderHeader(builder, data.contact, jobTitle);

  // Always render summary second
  renderSummary(builder, data.summary);

  // Render remaining sections based on style
  switch (style) {
    case ResumeStyle.CLASSIC:
      // Classic: Experience → Education → Skills
      renderExperience(builder, data.experience);
      renderEducation(builder, data.education);
      renderSkills(builder, data.skills);
      break;

    case ResumeStyle.HYBRID:
      // Hybrid: Skills → Experience → Education
      renderSkills(builder, data.skills);
      renderExperience(builder, data.experience);
      renderEducation(builder, data.education);
      break;

    case ResumeStyle.TECHNICAL:
      // Technical/Early-Career: Education → Skills → Experience
      renderEducation(builder, data.education);
      renderSkills(builder, data.skills);
      renderExperience(builder, data.experience);
      break;

    default:
      // Default to classic order
      renderExperience(builder, data.experience);
      renderEducation(builder, data.education);
      renderSkills(builder, data.skills);
  }

  return doc;
}

/**
 * Generates an aesthetic PDF for the cover letter
 */
export function generateCoverLetterPDF(content: string, contact: TailoredResumeData['contact']): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - (CONFIG.margin * 2);
  let cursorY = CONFIG.margin;

  // Header (consistent with resume)
  doc.setFont(CONFIG.font, 'bold');
  doc.setFontSize(CONFIG.sizes.name);
  doc.setTextColor(CONFIG.colors.primary[0], CONFIG.colors.primary[1], CONFIG.colors.primary[2]);
  doc.text(contact.name.toUpperCase(), pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 18;

  doc.setFont(CONFIG.font, 'normal');
  doc.setFontSize(CONFIG.sizes.contact);
  doc.setTextColor(CONFIG.colors.secondary[0], CONFIG.colors.secondary[1], CONFIG.colors.secondary[2]);
  const contactParts = [
    contact.email,
    contact.phone,
    contact.location,
    contact.linkedin
  ].filter(Boolean);
  doc.text(contactParts.join('  •  '), pageWidth / 2, cursorY, { align: 'center' });
  
  // Rule Line
  cursorY += 10;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(CONFIG.margin, cursorY, pageWidth - CONFIG.margin, cursorY);
  cursorY += 40;

  // Body
  doc.setFont(CONFIG.font, 'normal');
  doc.setFontSize(CONFIG.sizes.body);
  doc.setTextColor(CONFIG.colors.primary[0], CONFIG.colors.primary[1], CONFIG.colors.primary[2]);

  const lines: string[] = doc.splitTextToSize(content, contentWidth);
  
  // Handle multi-page if cover letter is very long
  lines.forEach((line) => {
    if (cursorY > pageHeight - CONFIG.margin) {
      doc.addPage();
      cursorY = CONFIG.margin;
    }
    doc.text(line, CONFIG.margin, cursorY);
    cursorY += CONFIG.sizes.body * 1.5;
  });

  return doc;
}
