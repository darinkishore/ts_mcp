// src/utils/WordIdGenerator.ts
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { results } from "../db/schema";
import { adjectives, nouns } from "./word-lists";

export class WordIdGenerator {
  private adjectives: readonly string[];
  private nouns: readonly string[];

  constructor() {
    this.adjectives = adjectives;
    this.nouns = nouns;
  }

  async generateResultId(): Promise<string> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const adj = this.getRandomWord(this.adjectives);
      const noun = this.getRandomWord(this.nouns);
      const resultId = `${adj}-${noun}`;

      // Check if ID exists in database
      const existing = await db
        .select()
        .from(results)
        .where(eq(results.id, resultId))
        .get();

      if (!existing) {
        return resultId;
      }

      attempts++;
    }

    // If we've exhausted attempts, add a random number
    const adj = this.getRandomWord(this.adjectives);
    const noun = this.getRandomWord(this.nouns);
    const random = Math.floor(Math.random() * 1000);
    return `${adj}-${noun}-${random}`;
  }

  private getRandomWord(words: readonly string[]): string {
    return words[Math.floor(Math.random() * words.length)];
  }
}

// Also export a singleton instance
export const wordIdGenerator = new WordIdGenerator();
