/**
 * Response type for Hello World API endpoint
 */
export interface HelloWorldResponse {
  message: string;
  timestamp: string;
}

/**
 * Metadata for Hello World application
 */
export interface HelloWorldMetadata {
  appName: string;
  environment: string;
}

/**
 * Represents the structure for generated content, including titles and tags.
 */
export interface GeneratedContent {
  titles: string[];
  tags: string[];
}