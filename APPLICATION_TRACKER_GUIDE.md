# Application Tracker - Purpose and Automation

## Current Purpose

The Application Tracker in CareerOS serves as a **centralized kanban board** for managing job applications across different stages:

- **Saved**: Jobs you're interested in but haven't applied to yet
- **Applied**: Jobs you've submitted applications for
- **Interview**: Jobs where you have upcoming or completed interviews
- **Offer**: Jobs where you've received an offer
- **Rejected**: Jobs where you've been rejected

## Current Features

### Manual Management
- **Manual Entry**: Add applications manually for jobs not in the scraped database
- **Status Updates**: Move applications between columns via dropdown
- **Job Details**: Shows company, title, and date for each application
- **MongoDB Sync**: All data persisted to MongoDB `applications` collection

### Integration with AI Workflow
When you run the full 6-agent workflow on a job:
1. Application is automatically created in "Saved" status
2. You can approve to move to "Applied" status
3. Timeline events are logged to the dashboard

## What It Does NOT Currently Do (Automation Gaps)

### Missing Automation Features
- **No automatic status updates** from external sources
- **No email integration** to track application confirmations
- **No calendar integration** for interview scheduling
- **No automatic follow-up reminders**
- **No deadline tracking** for application due dates
- **No notification system** for status changes

### Potential Future Automation

#### 1. Email Integration (Lemma Surfaces)
```python
# Could use Lemma's Gmail/Outlook surfaces to:
- Auto-detect application confirmation emails
- Extract interview dates from recruiter emails
- Update application status based on email content
- Schedule follow-up reminders
```

#### 2. Calendar Integration
```python
# Could integrate with:
- Google Calendar for interview scheduling
- Outlook Calendar for meeting reminders
- Auto-create calendar events from interview coach output
```

#### 3. Deadline Tracking
```python
# Could add:
- Application deadline tracking
- Interview countdown timers
- Follow-up reminder scheduling
- Priority-based sorting
```

#### 4. Notification System
```python
# Could implement:
- In-app notifications for status changes
- Email alerts for interview reminders
- Push notifications for urgent deadlines
- Daily/weekly summary emails
```

#### 5. Agent-Driven Automation
```python
# Could enhance agents to:
- Application Strategist: Auto-update status based on recommendation
- Interview Coach: Auto-schedule prep reminders
- Career Mentor: Suggest follow-up timing based on company research
```

## Current Data Schema

```javascript
{
  id: string,
  job_id: string,
  status: "Saved" | "Applied" | "Interview" | "Offer" | "Rejected",
  user_id: string,
  job_details: {
    title: string,
    company: string,
    location?: string,
    experience?: string
  },
  created_at: ISODate
}
```

## How to Use Effectively

### For Scraped Jobs
1. Browse jobs on Jobs page
2. Click "Launch Workflow" to run AI analysis
3. Review agent outputs (match score, resume optimization, interview prep)
4. Click "Approve & Apply" to move to tracker
5. Update status manually as you progress through pipeline

### For Manual Jobs
1. Go to Applications page
2. Click "Add Application"
3. Enter job title, company, and initial status
4. Track manually alongside scraped jobs

### Best Practices
- **Keep it updated**: Move applications through stages as you progress
- **Use interview prep**: Export interview questions for each interview
- **Track rejections**: Log rejections to identify patterns
- **Review offers**: Compare offers using the tracker

## Technical Implementation

### Backend API
- `POST /applications/` - Create application
- `GET /applications/` - List all applications
- `PUT /applications/{id}/status` - Update status

### Frontend Components
- `Applications.jsx` - Kanban board with manual entry
- `JobDetail.jsx` - Auto-creation from workflow
- `Dashboard.jsx` - Analytics and pipeline metrics

### Database
- Collection: `applications`
- Index: `user_id`, `job_id`, `status`
- Relationships: Links to `jobs` collection for scraped jobs

## Enhancement Roadmap

### Phase 1: Basic Automation
- [ ] Add deadline tracking to application schema
- [ ] Implement in-app notification system
- [ ] Add follow-up reminder scheduling

### Phase 2: External Integration
- [ ] Lemma Gmail surface integration
- [ ] Lemma Outlook surface integration
- [ ] Calendar integration for interviews

### Phase 3: Agent Automation
- [ ] Auto-status updates from Application Strategist
- [ ] Interview reminder scheduling from Interview Coach
- [ ] Follow-up suggestions from Career Mentor

### Phase 4: Advanced Features
- [ ] Application analytics and insights
- [ ] Offer comparison tools
- [ ] Rejection pattern analysis
- [ ] Success rate tracking by company/role

## Summary

The Application Tracker is currently a **manual kanban board** with basic AI workflow integration. It provides a centralized place to track all applications but lacks automation features that would make it truly "agentic." Future enhancements using Lemma's surfaces and enhanced agent capabilities could transform it into an automated application management system.
