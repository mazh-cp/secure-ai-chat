/**
 * Check Point Threat Emulation (TE) detailed log fields and findings
 * Based on Check Point R81 Threat Prevention Administration Guide
 * Reference: https://sc1.checkpoint.com/documents/R81/WebAdminGuides/EN/CP_R81_ThreatPrevention_AdminGuide/Topics-TPG/Log_Fields.htm
 */

export interface CheckPointTELogFields {
  // Core verdict and status
  verdict?: 'Malicious' | 'Benign' | 'Suspicious' | 'Unknown'
  status?: 'FOUND' | 'PARTIALLY_FOUND' | 'NOT_FOUND' | 'IN_PROGRESS' | 'QUEUED'
  
  // Analysis details
  analyzed_on?: string // e.g., "Check Point Threat Emulation Cloud"
  te_verdict_determined_by?: string // Emulators that determined the verdict
  confidence_level?: 'Low' | 'Medium' | 'High' | 'Critical'
  severity?: 'Low' | 'Medium' | 'High' | 'Critical'
  
  // Protection information
  protection_type?: string // e.g., "SMTP Emulation", "File Emulation"
  protection_name?: string // Specific name of the attack signature
  attack?: string // Name of the vulnerability category
  attack_info?: string // Description of the vulnerability
  attack_status?: string // Status of the attack (e.g., "Active")
  
  // Action taken
  action?: 'prevent' | 'detect' | 'inspect' | 'allow'
  action_details?: string // Description of the detected malicious action
  
  // File information
  file_risk?: number // Risk rate (0-10 scale)
  content_risk?: number // Risk of extracted content (0-10 scale)
  scrubbed_content?: string // Content that Threat Extraction removed
  suspicious_content?: string // Suspicious content found
  
  // Threat profile and configuration
  threat_profile?: string // Name of the IPS profile
  smartdefense_profile?: string // Name of the IPS profile if managed separately
  triggered_by?: string // Mechanism that triggered the protection
  
  // Vendor and source information
  vendor_list?: string // Vendor that provided the verdict (e.g., "Check Point ThreatCloud")
  
  // Confidence scores
  confidence?: number // Numeric confidence score (0-1)
  
  // Additional metadata
  description?: string // Additional information about detected attack
  reason?: string // Reason for detecting or stopping the attack
  
  // Hash information (already handled separately but may be in response)
  sha256?: string
  sha1?: string
  md5?: string
}

export interface CheckPointTEResponse {
  success: boolean
  verdict: 'safe' | 'malicious' | 'pending' | 'unknown'
  status: string
  logFields: CheckPointTELogFields
  rawResponse?: unknown // Store raw API response for debugging
}
