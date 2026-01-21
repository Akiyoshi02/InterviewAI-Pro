# Company Profile Enhancement - Required Fields

## Overview
To implement the enhanced "About Company" section on the job detail page (similar to XPRESSJOBS style), we need to collect additional information during company registration.

## Currently Collected Fields ✅

The following fields are **already being collected** during company registration:

1. **Company Name** (`companyName`) - ✅ Collected
2. **Company Size** (`companySize`) - ✅ Collected (ranges: "1-10", "11-50", "51-200", "201-1000", "1000+")
3. **Industry** (`industry`) - ✅ Collected
4. **Company Website** (`companyWebsite`) - ✅ Collected
5. **Company Location** (`companyLocation`) - ✅ Collected (city/region format)
6. **Company Logo** (`companyLogo`) - ✅ Collected (file upload)
7. **Phone Number** (`phoneNumber`) - ✅ Collected

## Missing Fields to Add 🔴

The following fields need to be **added** to the registration form and database:

### 1. **Physical Address** (Full Address)
- **Field Name:** `companyAddress` or `physicalAddress`
- **Type:** Multi-line text input
- **Required:** Optional (but recommended)
- **Placeholder:** "No.215, Nawala Road, Narahenpita, Colombo 05, Sri Lanka"
- **Description:** Complete physical address of the company headquarters
- **Display:** Shown with a house icon on the job detail page

### 2. **Company Description / About Us**
- **Field Name:** `companyDescription` or `aboutUs`
- **Type:** Rich text editor or large textarea (500-2000 characters)
- **Required:** Optional (but recommended for better company profile)
- **Placeholder:** "Tell candidates about your company, its history, mission, and values..."
- **Description:** Detailed company information including:
  - Company history (e.g., "Established since 1977")
  - Industry position (e.g., "Premier tile manufacturer")
  - Market presence (local/global)
  - Products/services
  - Technology/innovation focus
  - Environmental practices/commitments
- **Display:** Shown in the "About [Company Name]" section

### 3. **Social Media Links**

#### 3a. Facebook Page URL
- **Field Name:** `facebookUrl`
- **Type:** URL input
- **Required:** Optional
- **Placeholder:** "https://www.facebook.com/yourcompany"
- **Validation:** Must be a valid Facebook URL

#### 3b. LinkedIn Company Page URL
- **Field Name:** `linkedinUrl`
- **Type:** URL input
- **Required:** Optional
- **Placeholder:** "https://www.linkedin.com/company/yourcompany"
- **Validation:** Must be a valid LinkedIn URL

#### 3c. YouTube Channel URL
- **Field Name:** `youtubeUrl`
- **Type:** URL input
- **Required:** Optional
- **Placeholder:** "https://www.youtube.com/@yourcompany"
- **Validation:** Must be a valid YouTube URL

### 4. **Headquarters City** (for badge display)
- **Field Name:** `headquartersCity` or derive from `companyLocation`
- **Type:** Text input (single city name)
- **Required:** Optional (can be extracted from `companyLocation` if it's in "City, Region" format)
- **Placeholder:** "Colombo"
- **Description:** Primary city where the company is headquartered (for badge display)
- **Note:** This might be automatically extracted from `companyLocation` if we parse it correctly

### 5. **Employee Count Display Format**
- **Current:** `companySize` stores ranges like "1-10", "11-50", etc.
- **Enhancement:** Format display as "501-1K employees" style
- **Action:** Add a helper function to format `companySize` for display
- **Example Mapping:**
  - "1-10" → "1-10 employees"
  - "11-50" → "11-50 employees"
  - "51-200" → "51-200 employees"
  - "201-1000" → "201-1K employees"
  - "1000+" → "1K+ employees"

## Implementation Checklist

### Frontend Changes

1. **Update `CompanyFields.jsx`:**
   - [ ] Add `companyAddress` textarea field
   - [ ] Add `companyDescription` textarea/rich text editor
   - [ ] Add `facebookUrl` URL input
   - [ ] Add `linkedinUrl` URL input
   - [ ] Add `youtubeUrl` URL input
   - [ ] Add `headquartersCity` text input (or extract from location)

2. **Update `register/index.jsx`:**
   - [ ] Add new fields to `formData` state
   - [ ] Include new fields in registration payload
   - [ ] Add validation for URL fields (optional)

### Backend Changes

3. **Update `auth.controller.js`:**
   - [ ] Accept new fields in registration endpoint
   - [ ] Store new fields in user/organization document

4. **Update `firebaseData.service.js`:**
   - [ ] Add new fields to `organizationStore.create()` payload
   - [ ] Add new fields to `organizationStore.update()` method

5. **Update `auth.routes.js`:**
   - [ ] Add validation rules for new URL fields (optional, isURL)

6. **Update Organization Schema:**
   - [ ] Document new fields in organization collection

### Display Changes

7. **Update `job-detail/index.jsx`:**
   - [ ] Display company address with house icon
   - [ ] Display company description in "About" section
   - [ ] Display social media icons (Facebook, LinkedIn, YouTube) as clickable links
   - [ ] Display headquarters city badge
   - [ ] Format employee count display (e.g., "501-1K employees")
   - [ ] Display job post count (calculated dynamically from active jobs)

## Database Schema Updates

### Organizations Collection
Add the following fields to the `organizations` collection:

```javascript
{
  // ... existing fields ...
  address: string | null,              // Full physical address
  description: string | null,          // Company description/about us
  facebookUrl: string | null,          // Facebook page URL
  linkedinUrl: string | null,          // LinkedIn company page URL
  youtubeUrl: string | null,           // YouTube channel URL
  headquartersCity: string | null,     // Primary city (for badge)
  // Note: companySize already exists, just needs formatting for display
}
```

## UI/UX Considerations

1. **Registration Form:**
   - Group social media fields together in a "Social Media" section
   - Make all new fields optional to avoid overwhelming users
   - Add helpful placeholders and descriptions
   - Consider making company description a rich text editor for better formatting

2. **Job Detail Page:**
   - Display social media icons in a horizontal row
   - Show address with proper formatting
   - Make company description scrollable if long
   - Format employee count nicely (e.g., "501-1K employees")

3. **Validation:**
   - Validate URL formats for social media links
   - Limit company description length (e.g., max 2000 characters)
   - Sanitize user input for security

## Notes

- **Job Post Count:** This is calculated dynamically from active job listings and doesn't need to be stored
- **Company Logo:** Already collected, just needs to be displayed properly
- **Company Website:** Already collected, just needs to be displayed with proper icon
- **Employee Count:** Already collected as `companySize`, just needs formatting for display

## Priority

**High Priority:**
- Company Description (About Us)
- Physical Address
- Social Media Links (at least LinkedIn and Facebook)

**Medium Priority:**
- Headquarters City badge
- YouTube URL
- Employee count formatting

**Low Priority:**
- Rich text editor for company description (can start with textarea)
