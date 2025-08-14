# Meetup Data Archiver

Download and archive Meetup events and their photos, with support for creating comprehensive HTML indexes.

## Usage

### Archive a Single Event
```bash
node download-meetup-data.js event <event-id>
```
Downloads the event data and all photos for the specified Meetup event ID.

### Archive an Entire Group
```bash
node download-meetup-data.js group <group-name>
```
Downloads all events and their photos for the specified Meetup group. The script will:
- Create a directory for the group
- Scan for already downloaded events (resume capability)
- Download missing events with progress indicators
- Skip events that have already been downloaded

### Generate Archive Indexes
```bash
node download-meetup-data.js scan
```
Scans all downloaded event data and generates:
- Main `index.html` with events organized by year
- `attendees/` directory with cross-referenced user pages
- Individual attendee pages showing their event participation

## Output Structure

Events are saved to `downloads/{date-title}/` containing:
- `event-data.json` - Complete event metadata, RSVPs, and photos
- `photos/` - Downloaded event photos
- `index.html` - Event photo gallery

The archive index provides easy navigation through all events and attendees.
