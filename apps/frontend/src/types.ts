export interface BannerAnalysis {
  prompt: string;
  concept: string;
  image_alt: string;
  image_title: string;
}

export interface GeminiServiceConfig {
  apiKey?: string;
}

export interface Sample {
  id: string;
  label: string;
  content: string;
}
