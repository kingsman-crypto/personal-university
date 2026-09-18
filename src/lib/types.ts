export interface Course {
  id: string;
  title: string;
  description: string;
  category?: string;
  enabled: boolean;
  order: number;
  instructions: string;
  readingTimeMinutes?: number;
  sampleSnippet?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  suggestedAction?: string;
  extractedBrief?: string;
}

export interface NewsletterSettings {
  title: string;
  subtitle?: string;
  recipientEmail: string;
  recipientName: string;
  deliveryDays: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  deliveryTime: string; // "07:00"
  timezone: string;
  emailProvider: 'mock' | 'resend' | 'gmail';
  resendApiKey?: string;
  senderEmail?: string;
  gmailUser?: string;
  gmailAppPassword?: string;
}

export interface NewsletterSection {
  courseId: string;
  courseTitle: string;
  category?: string;
  readingTimeMinutes?: number;
  content: string;
  keyTakeaways?: string[];
  sourceLinks?: Array<{ title: string; url: string }>;
  topicTitle?: string;
  subject?: string;
  subjectKeywords?: string[];
}

export interface NewsletterIssue {
  id: string;
  date: string;
  editionNumber: number;
  title: string;
  sections: NewsletterSection[];
  generatedAt: string;
}
