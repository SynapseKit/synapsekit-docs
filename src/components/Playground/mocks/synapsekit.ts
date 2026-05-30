/**
 * SynapseKit Mock for Interactive Playground
 * 
 * Exports:
 * - Mock classes (for TypeScript reference)
 * - synapsekitMockCode: The source code as a string for Sandpack
 */

// ============================================
// Mock Implementations (TypeScript side)
// ============================================

export class RAGPipeline {
  private documents: string[] = [];

  constructor(options: any = {}) {}

  add(content: string) {
    this.documents.push(content);
    return this;
  }

  ask_sync(question: string): string {
    if (this.documents.length === 0) {
      return "No documents added yet. Use rag.add(\"...\") to load knowledge.";
    }
    return `Based on your documents, here's a simulated answer to: "${question}"`;
  }

  async *stream(question: string) {
    const answer = this.ask_sync(question);
    const tokens = answer.split(" ");
    for (const token of tokens) {
      await new Promise(r => setTimeout(r, 40));
      yield token + " ";
    }
  }
}

export class FunctionCallingAgent {
  async run(message: string): Promise<string> {
    await new Promise(r => setTimeout(r, 800));
    return `Agent would process: "${message}" using tools.`;
  }
}

export class StateGraph {
  addNode(name: string, fn: Function) { return this; }
  addEdge(from: string, to: string) { return this; }
  compile() {
    return {
      invoke: async (state: any) => {
        await new Promise(r => setTimeout(r, 600));
        return { ...state, status: "completed" };
      }
    };
  }
}

// ============================================
// Source Code as String (injected into Sandpack)
// ============================================

export const synapsekitMockCode = `
// SynapseKit Mock - Educational version for the playground

export class RAGPipeline {
  constructor(options = {}) {
    this.documents = [];
  }

  add(content) {
    // In a real implementation, this would chunk + embed the content
    this.documents.push(content);
    console.log("Document added to vector store.");
    return this;
  }

  ask_sync(question) {
    if (this.documents.length === 0) {
      return "No documents added yet. Use rag.add(\\"...\\") first.";
    }
    
    // Simple simulation: return a response that references the added content
    const context = this.documents.join(" | ");
    return "Based on the loaded documents: " + context.slice(0, 180) + "...";
  }

  async *stream(question) {
    const answer = this.ask_sync(question);
    const tokens = answer.split(" ");
    
    for (const token of tokens) {
      await new Promise(resolve => setTimeout(resolve, 35));
      yield token + " ";
    }
  }
}

export class FunctionCallingAgent {
  async run(message) {
    await new Promise(resolve => setTimeout(resolve, 750));
    
    if (message.toLowerCase().includes("weather")) {
      return "Current weather in San Francisco: Sunny, 21°C.";
    }
    
    return "I would use tools to answer: \\"" + message + "\\"";
  }
}

export class StateGraph {
  addNode(name, fn) { return this; }
  addEdge(from, to) { return this; }
  
  compile() {
    return {
      invoke: async (state) => {
        await new Promise(resolve => setTimeout(resolve, 550));
        return { ...state, status: "completed" };
      }
    };
  }
}
`;
