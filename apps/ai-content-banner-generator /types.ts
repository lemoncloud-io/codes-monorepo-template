export interface AnalysisResult {
  prompt: string;
  concept: string;
  image_alt: string;
  image_title: string;
}

export interface GenerationStep {
  name: string;
  input?: any;
  output: any;
  type: 'analyze' | 'generate';
}

export interface BannerData {
  imageUrl: string;
  analysis: AnalysisResult;
  steps: GenerationStep[];
}
