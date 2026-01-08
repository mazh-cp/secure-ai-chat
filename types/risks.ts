export interface OWASPRisk {
  id: string
  code: string
  name: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  year: number
}

export interface RiskAssociation {
  riskId: string
  logEntryId: string
  matchReason: string
  confidence: number
}

export const OWASP_TOP_10_2025: OWASPRisk[] = [
  {
    id: 'llm01',
    code: 'LLM01:2025',
    name: 'Prompt Injection',
    description: 'A Prompt Injection Vulnerability occurs when user prompts alter the intended behavior of an LLM-based application, potentially leading to unauthorized actions or data exposure.',
    severity: 'critical',
    category: 'Injection',
    year: 2025,
  },
  {
    id: 'llm02',
    code: 'LLM02:2025',
    name: 'Sensitive Information Disclosure',
    description: 'Sensitive information can affect both the LLM and its application ecosystem, including training data, user data, and proprietary model information.',
    severity: 'critical',
    category: 'Data Exposure',
    year: 2025,
  },
  {
    id: 'llm03',
    code: 'LLM03:2025',
    name: 'Supply Chain',
    description: 'LLM supply chains are susceptible to various vulnerabilities, which can compromise the integrity, security, and trustworthiness of AI applications.',
    severity: 'high',
    category: 'Supply Chain',
    year: 2025,
  },
  {
    id: 'llm04',
    code: 'LLM04:2025',
    name: 'Data and Model Poisoning',
    description: 'Data poisoning occurs when pre-training, fine-tuning, or embedding data is manipulated to introduce vulnerabilities or backdoors into the model.',
    severity: 'high',
    category: 'Poisoning',
    year: 2025,
  },
  {
    id: 'llm05',
    code: 'LLM05:2025',
    name: 'Improper Output Handling',
    description: 'Improper Output Handling refers specifically to insufficient validation, sanitization, and filtering of LLM outputs before they are presented to users or downstream systems.',
    severity: 'high',
    category: 'Output Handling',
    year: 2025,
  },
  {
    id: 'llm06',
    code: 'LLM06:2025',
    name: 'Excessive Agency',
    description: 'An LLM-based system is often granted a degree of agency, allowing it to make autonomous decisions and perform actions without adequate oversight.',
    severity: 'medium',
    category: 'Agency',
    year: 2025,
  },
  {
    id: 'llm07',
    code: 'LLM07:2025',
    name: 'System Prompt Leakage',
    description: 'The system prompt leakage vulnerability in LLMs refers to the unintended exposure of system prompts, instructions, or sensitive configuration details to end users.',
    severity: 'medium',
    category: 'Information Disclosure',
    year: 2025,
  },
  {
    id: 'llm08',
    code: 'LLM08:2025',
    name: 'Vector and Embedding Weaknesses',
    description: 'Vectors and embeddings vulnerabilities present significant security risks in systems that rely on semantic search, RAG (Retrieval-Augmented Generation), and similar technologies.',
    severity: 'medium',
    category: 'Embeddings',
    year: 2025,
  },
  {
    id: 'llm09',
    code: 'LLM09:2025',
    name: 'Misinformation',
    description: 'Misinformation from LLMs poses a core vulnerability for applications relying on AI-generated content, potentially leading to false information propagation.',
    severity: 'medium',
    category: 'Content Integrity',
    year: 2025,
  },
  {
    id: 'llm10',
    code: 'LLM10:2025',
    name: 'Unbounded Consumption',
    description: 'Unbounded Consumption refers to the process where a Large Language Model consumes excessive resources, potentially leading to denial of service or cost overruns.',
    severity: 'low',
    category: 'Resource Management',
    year: 2025,
  },
]

export function mapLakeraCategoryToOWASPRisk(category: string): string | null {
  const categoryMap: Record<string, string> = {
    // LLM01: Prompt Injection
    'prompt_injection': 'llm01',
    'jailbreak': 'llm01',
    'prompt_injection_attempt': 'llm01',
    'injection': 'llm01',
    
    // LLM02: Sensitive Information Disclosure
    'pii': 'llm02',
    'data_leakage': 'llm02',
    'sensitive_data': 'llm02',
    'personal_information': 'llm02',
    'credit_card': 'llm02',
    'ssn': 'llm02',
    
    // LLM05: Improper Output Handling
    'harmful_content': 'llm05',
    'inappropriate_content': 'llm05',
    'violence': 'llm05',
    'self_harm': 'llm05',
    
    // LLM09: Misinformation
    'toxic': 'llm09',
    'misinformation': 'llm09',
    'hallucination': 'llm09',
    'false_information': 'llm09',
  }
  
  const lowerCategory = category.toLowerCase()
  
  // Check exact match first
  if (categoryMap[lowerCategory]) {
    return categoryMap[lowerCategory]
  }
  
  // Check partial matches
  for (const [key, value] of Object.entries(categoryMap)) {
    if (lowerCategory.includes(key) || key.includes(lowerCategory)) {
      return value
    }
  }
  
  return null
}

export function getAssociatedRisksFromLakeraDecision(
  categories?: Record<string, boolean>,
  action?: string,
  type?: string
): string[] {
  const risks: string[] = []
  
  // Map based on Lakera categories
  if (categories) {
    Object.keys(categories).forEach(category => {
      if (categories[category]) {
        const riskId = mapLakeraCategoryToOWASPRisk(category)
        if (riskId && !risks.includes(riskId)) {
          risks.push(riskId)
        }
      }
    })
  }
  
  // Map based on action type
  if (action === 'blocked' && !risks.includes('llm01')) {
    risks.push('llm01')
  }
  
  // Map based on log type
  if (type === 'file_scan') {
    if (!risks.includes('llm08')) {
      risks.push('llm08')
    }
  }
  
  if (type === 'error') {
    if (!risks.includes('llm03')) {
      risks.push('llm03')
    }
  }
  
  return risks
}

