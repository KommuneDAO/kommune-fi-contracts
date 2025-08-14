#!/usr/bin/env node

/**
 * Setup GitHub Milestones Script
 * 
 * This script creates milestones in your GitHub repository
 * Usage: GITHUB_TOKEN=your_token REPO=owner/repo node setupGithubMilestones.js
 * 
 * Prerequisites:
 * 1. GitHub Personal Access Token with repo scope
 * 2. Repository owner and name
 * 
 * Example:
 * GITHUB_TOKEN=ghp_xxxx REPO=KommuneFi/contracts node scripts/utils/setupGithubMilestones.js
 */

const fs = require('fs');
const path = require('path');

// Check for required environment variables
if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    console.log('Usage: GITHUB_TOKEN=your_token REPO=owner/repo node setupGithubMilestones.js');
    process.exit(1);
}

if (!process.env.REPO) {
    console.error('❌ REPO environment variable is required (format: owner/repo)');
    console.log('Usage: GITHUB_TOKEN=your_token REPO=owner/repo node setupGithubMilestones.js');
    process.exit(1);
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const [OWNER, REPO] = process.env.REPO.split('/');

if (!OWNER || !REPO) {
    console.error('❌ Invalid REPO format. Use: owner/repo');
    process.exit(1);
}

// Read milestones configuration
const milestonesPath = path.join(__dirname, '../../.github/milestones.json');
const milestonesData = JSON.parse(fs.readFileSync(milestonesPath, 'utf8'));

/**
 * Create a milestone using GitHub API
 */
async function createMilestone(milestone) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/milestones`;
    
    const body = {
        title: milestone.title,
        description: milestone.description,
        due_on: milestone.due_on,
        state: milestone.state || 'open'
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (response.status === 201) {
            const data = await response.json();
            console.log(`✅ Created milestone: ${milestone.title}`);
            return data;
        } else if (response.status === 422) {
            console.log(`⚠️  Milestone already exists: ${milestone.title}`);
            return null;
        } else {
            const error = await response.text();
            console.error(`❌ Failed to create milestone ${milestone.title}: ${error}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error creating milestone ${milestone.title}:`, error.message);
        return null;
    }
}

/**
 * Create an issue for a milestone
 */
async function createIssue(issue, milestoneNumber) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/issues`;
    
    const body = {
        title: issue.title,
        body: issue.body || '',
        labels: issue.labels || [],
        milestone: milestoneNumber
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (response.status === 201) {
            const data = await response.json();
            console.log(`  ✅ Created issue: ${issue.title}`);
            return data;
        } else {
            const error = await response.text();
            console.error(`  ❌ Failed to create issue ${issue.title}: ${error}`);
            return null;
        }
    } catch (error) {
        console.error(`  ❌ Error creating issue ${issue.title}:`, error.message);
        return null;
    }
}

/**
 * Get existing milestones
 */
async function getExistingMilestones() {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/milestones?state=all&per_page=100`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
            }
        });

        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.error('❌ Failed to fetch existing milestones');
            return [];
        }
    } catch (error) {
        console.error('❌ Error fetching milestones:', error.message);
        return [];
    }
}

/**
 * Main function to set up all milestones
 */
async function setupMilestones() {
    console.log('🚀 Setting up GitHub Milestones...');
    console.log(`Repository: ${OWNER}/${REPO}\n`);

    // Get existing milestones
    const existingMilestones = await getExistingMilestones();
    const existingTitles = existingMilestones.map(m => m.title);

    console.log(`Found ${existingMilestones.length} existing milestones\n`);

    // Process each milestone
    for (const milestone of milestonesData.milestones) {
        // Check if milestone already exists
        const existing = existingMilestones.find(m => m.title === milestone.title);
        
        if (existing) {
            console.log(`⏭️  Skipping existing milestone: ${milestone.title}`);
            
            // Create issues for existing milestone if they exist
            if (milestone.issues && milestone.issues.length > 0) {
                console.log(`  Creating ${milestone.issues.length} issues...`);
                for (const issue of milestone.issues) {
                    await createIssue(issue, existing.number);
                }
            }
        } else {
            // Create new milestone
            const created = await createMilestone(milestone);
            
            // Create issues if milestone was created successfully
            if (created && milestone.issues && milestone.issues.length > 0) {
                console.log(`  Creating ${milestone.issues.length} issues...`);
                for (const issue of milestone.issues) {
                    await createIssue(issue, created.number);
                }
            }
        }
    }

    console.log('\n✅ Milestone setup complete!');
    console.log('\n📊 Summary:');
    console.log(`- Total milestones: ${milestonesData.milestones.length}`);
    console.log(`- Completed: ${milestonesData.milestones.filter(m => m.state === 'closed').length}`);
    console.log(`- In Progress: ${milestonesData.milestones.filter(m => m.state === 'open').length}`);
    
    console.log('\n🔗 View milestones at:');
    console.log(`https://github.com/${OWNER}/${REPO}/milestones`);
}

// Run the setup
setupMilestones().catch(console.error);