import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sleepMillis = parseInt(process.env.SLEEP_MILLIS ?? 5000);
const verbose = process.env.VERBOSE === '1';

function sleepAsync(millis) {
    return new Promise((res, rej) => setTimeout(res, millis));
}

function formatEventDirectoryName(dateTime, title) {
    // Format date as YYYYMMDD
    const date = new Date(dateTime);
    const dateStr = date.getFullYear().toString() + 
                   (date.getMonth() + 1).toString().padStart(2, '0') + 
                   date.getDate().toString().padStart(2, '0');
    
    // Clean title: lowercase, remove punctuation, replace spaces with hyphens
    const cleanTitle = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove punctuation except hyphens and spaces
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
    
    return `${dateStr}-${cleanTitle}`;
}

function generateEventHTML(eventData) {
    const formatDate = (dateString) => {
        if (!dateString) return 'Not specified';
        return new Date(dateString).toLocaleString();
    };

    const escapeHtml = (text) => {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const formatDescription = (description) => {
        if (!description) return 'No description available.';
        return description.replace(/\n/g, '<br>');
    };

    const photoGallery = eventData.photos.map(photo => {
        // Legacy API uses 'source', new API uses 'highResUrl', 'standardUrl', 'baseUrl'
        const photoUrl = photo.source || photo.highResUrl || photo.standardUrl || photo.baseUrl;
        const filename = `photo-${photo.id}${path.extname(photoUrl) || '.jpg'}`;
        return `
            <div class="photo-item">
                <a href="photos/${filename}" target="_blank">
                    <img src="photos/${filename}" alt="Event photo ${photo.id}" loading="lazy">
                </a>
            </div>
        `;
    }).join('');

    const commentsList = eventData.comments.map(comment => `
        <div class="comment">
            <div class="comment-header">
                <strong>${escapeHtml(comment.member?.name || 'Anonymous')}</strong>
                <span class="comment-date">${formatDate(comment.created)}</span>
            </div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
        </div>
    `).join('');

    const rsvpsList = eventData.rsvps
        .sort((a, b) => new Date(b.created) - new Date(a.created))
        .map(rsvp => `
        <div class="rsvp ${rsvp.response.toLowerCase()}">
            <div class="rsvp-header">
                <strong>${escapeHtml(rsvp.member?.name || 'Anonymous')}</strong>
                <span class="rsvp-response ${rsvp.response.toLowerCase()}">${rsvp.response}</span>
                <span class="rsvp-date">${formatDate(rsvp.created)}</span>
            </div>
            ${rsvp.guests > 0 ? `<div class="rsvp-guests">+${rsvp.guests} guest${rsvp.guests !== 1 ? 's' : ''}</div>` : ''}
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(eventData.title || 'Meetup Event')}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .event-header {
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .event-title {
            color: #1a1a1a;
            margin: 0 0 15px 0;
            font-size: 2.2em;
            font-weight: 600;
        }
        .event-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        .meta-item {
            display: flex;
            flex-direction: column;
        }
        .meta-label {
            font-weight: 600;
            color: #555;
            font-size: 0.9em;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .meta-value {
            color: #333;
        }
        .section {
            margin: 40px 0;
        }
        .section-title {
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 1.5em;
        }
        .description {
            line-height: 1.6;
            color: #444;
            font-size: 1.1em;
        }
        .photo-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .photo-item img {
            width: 100%;
            height: 150px;
            object-fit: cover;
            border-radius: 6px;
            transition: transform 0.2s;
            cursor: pointer;
        }
        .photo-item img:hover {
            transform: scale(1.05);
        }
        .comments {
            margin-top: 20px;
        }
        .comment {
            border-left: 4px solid #007bff;
            padding: 15px;
            margin: 15px 0;
            background: #f8f9fa;
            border-radius: 0 6px 6px 0;
        }
        .comment-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .comment-date {
            color: #666;
            font-size: 0.9em;
        }
        .comment-text {
            color: #333;
            line-height: 1.5;
        }
        .rsvps {
            margin-top: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 10px;
        }
        .rsvp {
            padding: 12px 15px;
            background: #f8f9fa;
            border-radius: 6px;
            border-left: 4px solid #28a745;
        }
        .rsvp.no {
            border-left-color: #dc3545;
            background: #fff5f5;
        }
        .rsvp.waitlist {
            border-left-color: #ffc107;
            background: #fffbf0;
        }
        .rsvp-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        .rsvp-response {
            font-size: 0.8em;
            font-weight: 600;
            text-transform: uppercase;
            padding: 2px 6px;
            border-radius: 3px;
            color: white;
        }
        .rsvp-response.yes {
            background-color: #28a745;
        }
        .rsvp-response.no {
            background-color: #dc3545;
        }
        .rsvp-response.waitlist {
            background-color: #ffc107;
            color: #333;
        }
        .rsvp-date {
            color: #666;
            font-size: 0.9em;
        }
        .rsvp-guests {
            font-size: 0.9em;
            color: #666;
            margin-top: 5px;
        }
        .stats-bar {
            display: flex;
            gap: 30px;
            padding: 15px 0;
            border-top: 1px solid #e0e0e0;
            margin-top: 20px;
        }
        .stat {
            text-align: center;
        }
        .stat-number {
            font-size: 1.8em;
            font-weight: bold;
            color: #007bff;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
        }
        .link {
            color: #007bff;
            text-decoration: none;
        }
        .link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="event-header">
            <h1 class="event-title">${escapeHtml(eventData.title || 'Meetup Event')}</h1>
            
            <div class="event-meta">
                <div class="meta-item">
                    <span class="meta-label">Date & Time</span>
                    <span class="meta-value">${formatDate(eventData.dateTime)}</span>
                </div>
                ${eventData.duration ? `
                <div class="meta-item">
                    <span class="meta-label">Duration</span>
                    <span class="meta-value">${eventData.duration} minutes</span>
                </div>
                ` : ''}
                ${eventData.venue ? `
                <div class="meta-item">
                    <span class="meta-label">Venue</span>
                    <span class="meta-value">
                        ${escapeHtml(eventData.venue.name)}<br>
                        ${escapeHtml([eventData.venue.address, eventData.venue.city, eventData.venue.state, eventData.venue.postalCode].filter(Boolean).join(', '))}
                    </span>
                </div>
                ` : ''}
                ${eventData.group ? `
                <div class="meta-item">
                    <span class="meta-label">Group</span>
                    <span class="meta-value">${escapeHtml(eventData.group.name)}</span>
                </div>
                ` : ''}
                ${eventData.eventUrl ? `
                <div class="meta-item">
                    <span class="meta-label">Event URL</span>
                    <span class="meta-value"><a href="${eventData.eventUrl}" class="link" target="_blank">View on Meetup</a></span>
                </div>
                ` : ''}
            </div>

            <div class="stats-bar">
                <div class="stat">
                    <div class="stat-number">${eventData.photos.length}</div>
                    <div class="stat-label">Photos</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${eventData.comments.length}</div>
                    <div class="stat-label">Comments</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${eventData.rsvps.length}</div>
                    <div class="stat-label">RSVPs</div>
                </div>
                ${eventData.photoCount ? `
                <div class="stat">
                    <div class="stat-number">${eventData.photoCount}</div>
                    <div class="stat-label">Total Photos</div>
                </div>
                ` : ''}
            </div>
        </header>

        ${eventData.description ? `
        <section class="section">
            <h2 class="section-title">Description</h2>
            <div class="description">${formatDescription(eventData.description)}</div>
        </section>
        ` : ''}

        ${eventData.photos.length > 0 ? `
        <section class="section">
            <h2 class="section-title">Photos (${eventData.photos.length})</h2>
            <div class="photo-gallery">
                ${photoGallery}
            </div>
        </section>
        ` : ''}

        ${eventData.rsvps.length > 0 ? `
        <section class="section">
            <h2 class="section-title">RSVPs (${eventData.rsvps.length})</h2>
            <div class="rsvps">
                ${rsvpsList}
            </div>
        </section>
        ` : ''}

        ${eventData.comments.length > 0 ? `
        <section class="section">
            <h2 class="section-title">Comments (${eventData.comments.length})</h2>
            <div class="comments">
                ${commentsList}
            </div>
        </section>
        ` : ''}
    </div>
</body>
</html>`;
}

async function queryMeetup(query, variables, legacy = false) {
    const endpoint = legacy ? 'https://api.meetup.com/gql' : 'https://api.meetup.com/gql-ext';
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
            variables
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${await response.text()}`);
    }

    const resp = await response.json();
    if (verbose)
	console.log(resp);
    return resp;
}

async function fetchPhotosFromLegacyAPI(eventId) {
    try {
        const photosQuery = fs.readFileSync(path.join(__dirname, 'photos.graphql'), 'utf8');
        if (verbose)
            console.log(`Fetching photos from legacy API for event ID: ${eventId}`);
        const response = await queryMeetup(photosQuery, { eventId }, true);
        await sleepAsync(sleepMillis);
        
        if (!response.data || !response.data.event || !response.data.event.photoAlbum) {
            console.log('No photos found in legacy API response');
            return [];
        }
        
        return response.data.event.photoAlbum.photoSample || [];
    } catch (error) {
        console.error('Error fetching photos from legacy API:', error.message);
        return [];
    }
}

async function downloadFile(url, filepath) {
    if (fs.existsSync(filepath)) {
	if (verbose)
	     console.log(`skipping download of ${url} to ${filepath}`);
	return;
    }
    await sleepAsync(sleepMillis);
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

async function downloadMeetupEventData(eventId, baseDir) {
    try {
        const eventQuery = `
            query($eventId: ID!) {
                event(id: $eventId) {
                    id
                    title
                    description
                    dateTime
                    duration
                    eventUrl
                    photoAlbum {
                        id
                        title
			photoCount
                    }
                    featuredEventPhoto {
                        id
                        baseUrl
                        highResUrl
                        standardUrl
                        thumbUrl
                    }
                    venues {
                        id
                        name
                        address
                        city
                        state
                        postalCode
                    }
                    group {
                        id
                        name
                        urlname
                    }
                    rsvps(first: 100) {
                        edges {
                            node {
                                id
                                updated
                                status
                                guestsCount
                                member {
                                    id
                                    name
                                }
                            }
                        }
                    }
                }
            }
        `;

        if (verbose)
            console.log(`Fetching event data for event ID: ${eventId}`);
        const response = await queryMeetup(eventQuery, { eventId });
        await sleepAsync(sleepMillis);
        
        if (!response.data || !response.data.event) {
            throw new Error('Event not found or invalid response');
        }

        const event = response.data.event;
        
        // Fetch photos from legacy API
        const legacyPhotos = await fetchPhotosFromLegacyAPI(eventId);
        
        const dirName = formatEventDirectoryName(event.dateTime, event.title);
        const outputDir = path.join(baseDir, dirName);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const eventData = {
            id: event.id,
            title: event.title,
            description: event.description,
            dateTime: event.dateTime,
            duration: event.duration,
            eventUrl: event.eventUrl,
            venue: event.venues?.[0] || null,  // venues is now an array, take first one
            group: event.group,
            comments: [], // Comments removed from initial query - will need separate query if needed
            rsvps: event.rsvps?.edges?.map(edge => ({
                id: edge.node.id,
                created: edge.node.updated,
                response: edge.node.status,
                guests: edge.node.guestsCount,
                member: edge.node.member
            })) || [],
            photoCount: event.photoAlbum?.photoCount || 0,
            photos: legacyPhotos // Use photos from legacy API
        };

        fs.writeFileSync(
            path.join(outputDir, 'raw.json'),
            JSON.stringify(response, null, 2)
        );
        fs.writeFileSync(
            path.join(outputDir, 'event-data.json'),
            JSON.stringify(eventData, null, 2)
        );
        if (verbose) {
            console.log(`Event data saved to ${outputDir}/event-data.json`);
        }

	const photosDir = path.join(outputDir, 'photos');
	if (!fs.existsSync(photosDir)) {
	    fs.mkdirSync(photosDir, { recursive: true });
	}

	console.log(`Downloading ${eventData.photos.length} photos... [${outputDir}]`);
	let seq = 0;
	for (const photo of eventData.photos) {
	    seq++;
	    if (!verbose)
		process.stdout.write(`\rimage ${seq} of ${eventData.photos.length}`);
	    try {
		// Legacy API uses 'source', new API uses 'highResUrl', 'standardUrl', 'baseUrl'
		const photoUrl = photo.source || photo.highResUrl || photo.standardUrl || photo.baseUrl;
		if (photoUrl) {
		    const photoExtension = path.extname(photoUrl) || '.jpg';
		    const photoFilename = `photo-${photo.id}${photoExtension}`;
		    const photoPath = path.join(photosDir, photoFilename);
		    
		    await downloadFile(photoUrl, photoPath);
		    if (verbose)
		        console.log(`Downloaded: ${photoFilename}`);
		}
	    } catch (error) {
		console.error(`Failed to download photo ${photo.id}:`, error.message);
	    }
	}
	if (!verbose)
            process.stdout.write(`\rfinished downloading ${eventData.photos.length} photos!\n`);

        // Generate HTML file
        const htmlContent = generateEventHTML(eventData);
        fs.writeFileSync(
            path.join(outputDir, 'index.html'),
            htmlContent
        );
        if (verbose) {
	    console.log(`HTML file saved to ${outputDir}/index.html`);

	    console.log('\nDownload Summary:');
	    console.log(`Event: ${event.title}`);
	    console.log(`Description length: ${event.description?.length || 0} characters`);
	    console.log(`Comments: ${eventData.comments.length}`);
	    console.log(`RSVPs: ${eventData.rsvps.length}`);
	    console.log(`Photos: ${eventData.photos.length}`);
	    console.log(`Output directory: ${outputDir}`);
	} else {
	    console.log(`${outputDir}: ${event.title} (${eventData.photos.length} images)`);
	}

        fs.writeFileSync(
            path.join(outputDir, 'ID'),
            eventId
        );

        return eventData;

    } catch (error) {
        console.error('Error downloading meetup event data:', error.message);
        throw error;
    }
}

async function downloadMeetupGroupData(groupId) {
   const eventIds = [];
   let cursor;
    if (!fs.existsSync(groupId)) {
        fs.mkdirSync(groupId, { recursive: true });
    }
   for (;;) {
	const after = cursor ? `after: "${cursor}"` : '';
        const query = `
            query($groupId: String!) {
                groupByUrlname(urlname: $groupId) {
                    id
		    events(${after} status: PAST) {
		        pageInfo { hasNextPage startCursor endCursor }
			edges {
			    node { id }
			}
		    }
	        }
            }
        `;

        console.log(`Fetching event data for group ID: ${groupId}`);
        const response = await queryMeetup(query, { groupId });
        await sleepAsync(sleepMillis);
        console.log(JSON.stringify(response, null, 2));
	const group = response.data.groupByUrlname;
	for (const {node} of group.events.edges) {
		  eventIds.push(node.id);
	}

        if (!group.events.pageInfo.hasNextPage) {
	    break;
	}
	cursor = group.events.pageInfo.endCursor;
   }
   //console.log(eventIds);
   fs.writeFileSync(
	   `${groupId}/events`,
	   eventIds.join("\n") + "\n"
   );

   // scan all groupId/*/ID files to find completed events
   // to skip.
   const ids_completed = {};
   for (let dir in readdir(groupId)) {
      try {
          const id = fs.readFileSync(path.join(groupId, dir, 'ID'), 'utf-8').strip();
	  ids_completed[id] = true;
      } catch (err) {
      }
   }

   for (const eventId of eventIds) {
       if (!(eventId in ids_completed)) {
           await downloadMeetupEventData(eventId, groupId);
       }
   }
} 

async function scanEvents() {
    const downloadsDir = path.join(__dirname, 'downloads');
    const attendeesDir = path.join(__dirname, 'attendees');
    
    if (!fs.existsSync(downloadsDir)) {
        console.error('Downloads directory not found');
        return;
    }

    // Create attendees directory
    if (!fs.existsSync(attendeesDir)) {
        fs.mkdirSync(attendeesDir, { recursive: true });
    }

    console.log('Scanning events...');
    
    // Get all event directories
    const eventDirs = fs.readdirSync(downloadsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort();

    const events = [];
    const attendeesMap = new Map(); // memberId -> { member, events[] }

    // Process each event directory
    for (const eventDir of eventDirs) {
        const eventDataPath = path.join(downloadsDir, eventDir, 'event-data.json');
        
        if (!fs.existsSync(eventDataPath)) {
            console.log(`Skipping ${eventDir} - no event-data.json found`);
            continue;
        }

        try {
            const eventData = JSON.parse(fs.readFileSync(eventDataPath, 'utf8'));
            
            // Parse date to get year
            const eventDate = new Date(eventData.dateTime);
            const year = eventDate.getFullYear();
            
            const event = {
                id: eventData.id,
                title: eventData.title,
                dateTime: eventData.dateTime,
                date: eventDate,
                year: year,
                rsvpCount: eventData.rsvps?.length || 0,
                photoCount: eventData.photos?.length || 0,
                directory: eventDir,
                venue: eventData.venue,
                group: eventData.group,
                rsvps: eventData.rsvps || []
            };
            
            events.push(event);
            
            // Process RSVPs for attendees index
            for (const rsvp of eventData.rsvps || []) {
                if (rsvp.member && rsvp.member.id) {
                    const memberId = rsvp.member.id;
                    
                    if (!attendeesMap.has(memberId)) {
                        attendeesMap.set(memberId, {
                            member: rsvp.member,
                            events: []
                        });
                    }
                    
                    attendeesMap.get(memberId).events.push({
                        ...event,
                        rsvpStatus: rsvp.response,
                        rsvpDate: rsvp.created
                    });
                }
            }
            
            console.log(`Processed: ${eventData.title} (${year}) - ${event.rsvpCount} RSVPs`);
            
        } catch (error) {
            console.error(`Error processing ${eventDir}:`, error.message);
        }
    }

    console.log(`Found ${events.length} events with ${attendeesMap.size} unique attendees`);
    
    // Generate main index.html
    await generateMainIndex(events);
    
    // Generate attendee pages
    await generateAttendeePages(attendeesMap, attendeesDir);
    
    console.log('Event scanning completed!');
    console.log(`Main index: ${path.join(__dirname, 'index.html')}`);
    console.log(`Attendee pages: ${attendeesDir}/`);
}

async function generateMainIndex(events) {
    // Group events by year
    const eventsByYear = events.reduce((acc, event) => {
        if (!acc[event.year]) {
            acc[event.year] = [];
        }
        acc[event.year].push(event);
        return acc;
    }, {});

    // Sort events within each year by date (newest first)
    Object.keys(eventsByYear).forEach(year => {
        eventsByYear[year].sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    const years = Object.keys(eventsByYear).sort((a, b) => b - a);
    const totalEvents = events.length;
    const totalRSVPs = events.reduce((sum, event) => sum + event.rsvpCount, 0);
    const totalPhotos = events.reduce((sum, event) => sum + event.photoCount, 0);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            weekday: 'short'
        });
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SGV Hikers Events Archive</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            border-radius: 15px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 2.5em;
            font-weight: 700;
        }
        .header .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }
        .stat-label {
            color: #666;
            font-weight: 500;
        }
        .year-section {
            background: white;
            margin-bottom: 30px;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .year-header {
            background: linear-gradient(90deg, #4CAF50, #45a049);
            color: white;
            padding: 20px 30px;
            font-size: 1.8em;
            font-weight: 600;
        }
        .events-list {
            background: white;
            border-radius: 8px;
            overflow: hidden;
        }
        .event-row {
            display: grid;
            grid-template-columns: 140px 1fr auto auto;
            gap: 20px;
            padding: 16px 20px;
            border-bottom: 1px solid #e0e0e0;
            align-items: center;
            transition: background-color 0.2s;
        }
        .event-row:hover {
            background-color: #f8f9fa;
        }
        .event-row:last-child {
            border-bottom: none;
        }
        .event-date {
            color: #666;
            font-size: 0.9em;
            font-weight: 500;
            text-align: left;
            white-space: nowrap;
        }
        .event-title {
            font-size: 1.05em;
            font-weight: 600;
            color: #333;
            line-height: 1.3;
        }
        .event-title a {
            color: #333;
            text-decoration: none;
        }
        .event-title a:hover {
            color: #667eea;
        }
        .venue {
            color: #888;
            font-size: 0.85em;
            margin-top: 4px;
        }
        .event-rsvps {
            color: #666;
            font-size: 0.9em;
            text-align: center;
            white-space: nowrap;
        }
        .event-photos {
            color: #666;
            font-size: 0.9em;
            text-align: center;
            white-space: nowrap;
        }
        .navigation {
            position: sticky;
            top: 20px;
            background: white;
            padding: 15px 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 100;
        }
        .nav-links {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            align-items: center;
        }
        .nav-links a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
            padding: 5px 10px;
            border-radius: 5px;
            transition: background-color 0.2s;
        }
        .nav-links a:hover {
            background-color: #f0f0f0;
        }
        @media (max-width: 768px) {
            .event-row {
                grid-template-columns: 1fr;
                gap: 10px;
                text-align: left;
            }
            .event-rsvps, .event-photos {
                text-align: left;
            }
            .stats {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>SGV Hikers Events Archive</h1>
        <div class="subtitle">Complete archive of hiking events and adventures</div>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${totalEvents}</div>
            <div class="stat-label">Total Events</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${totalRSVPs}</div>
            <div class="stat-label">Total RSVPs</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${totalPhotos}</div>
            <div class="stat-label">Total Photos</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${years.length}</div>
            <div class="stat-label">Years Active</div>
        </div>
    </div>

    <div class="navigation">
        <div class="nav-links">
            <strong>Jump to year:</strong>
            ${years.map(year => `<a href="#year-${year}">${year}</a>`).join('')}
            <span style="margin-left: auto;"><a href="attendees/">👥 View Attendees</a></span>
        </div>
    </div>

    ${years.map(year => `
    <div class="year-section" id="year-${year}">
        <div class="year-header">
            ${year} (${eventsByYear[year].length} events)
        </div>
        <div class="events-list">
            ${eventsByYear[year].map(event => `
            <div class="event-row">
                <div class="event-date">${formatDate(event.dateTime)}</div>
                <div class="event-info">
                    <div class="event-title">
                        <a href="downloads/${event.directory}/">${event.title}</a>
                    </div>
                    ${event.venue ? `<div class="venue">📍 ${event.venue.name}</div>` : ''}
                </div>
                <div class="event-rsvps">👥 ${event.rsvpCount}</div>
                <div class="event-photos">📸 ${event.photoCount}</div>
            </div>
            `).join('')}
        </div>
    </div>
    `).join('')}

</body>
</html>`;

    fs.writeFileSync(path.join(__dirname, 'index.html'), html);
    console.log('Generated main index.html');
}

async function generateAttendeePages(attendeesMap, attendeesDir) {
    // Generate attendees index
    const attendeesList = Array.from(attendeesMap.entries())
        .map(([memberId, data]) => ({
            id: memberId,
            name: data.member.name,
            eventCount: data.events.length,
            events: data.events.sort((a, b) => new Date(b.date) - new Date(a.date))
        }))
        .sort((a, b) => b.eventCount - a.eventCount);

    const attendeesIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SGV Hikers - Attendees</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
        }
        .back-link {
            text-align: center;
            margin-bottom: 20px;
        }
        .back-link a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        .attendees-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }
        .attendee-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .attendee-card:hover {
            transform: translateY(-2px);
        }
        .attendee-name {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .attendee-name a {
            color: #333;
            text-decoration: none;
        }
        .attendee-name a:hover {
            color: #667eea;
        }
        .event-count {
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="back-link">
        <a href="../">← Back to Events</a>
    </div>
    
    <div class="header">
        <h1>SGV Hikers Attendees</h1>
        <p>${attendeesList.length} members who have RSVP'd to events</p>
    </div>

    <div class="attendees-grid">
        ${attendeesList.map(attendee => `
        <div class="attendee-card">
            <div class="attendee-name">
                <a href="${attendee.id}.html">${attendee.name}</a>
            </div>
            <div class="event-count">${attendee.eventCount} event${attendee.eventCount !== 1 ? 's' : ''}</div>
        </div>
        `).join('')}
    </div>
</body>
</html>`;

    fs.writeFileSync(path.join(attendeesDir, 'index.html'), attendeesIndexHtml);

    // Generate individual attendee pages
    for (const [memberId, data] of attendeesMap.entries()) {
        const attendee = {
            id: memberId,
            name: data.member.name,
            events: data.events.sort((a, b) => new Date(b.date) - new Date(a.date))
        };

        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                weekday: 'short'
            });
        };

        const attendeeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${attendee.name} - SGV Hikers</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .back-link {
            margin-bottom: 20px;
        }
        .back-link a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        .header {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .event {
            background: white;
            padding: 20px;
            margin-bottom: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .event-date {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 5px;
        }
        .event-title {
            font-size: 1.1em;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .event-title a {
            color: #333;
            text-decoration: none;
        }
        .event-title a:hover {
            color: #667eea;
        }
        .event-meta {
            display: flex;
            gap: 15px;
            color: #666;
            font-size: 0.85em;
        }
        .rsvp-status {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 500;
        }
        .rsvp-yes {
            background: #d4edda;
            color: #155724;
        }
        .rsvp-no {
            background: #f8d7da;
            color: #721c24;
        }
    </style>
</head>
<body>
    <div class="back-link">
        <a href="index.html">← Back to Attendees</a>
    </div>

    <div class="header">
        <h1>${attendee.name}</h1>
        <p>Participated in ${attendee.events.length} event${attendee.events.length !== 1 ? 's' : ''}</p>
    </div>

    ${attendee.events.map(event => `
    <div class="event">
        <div class="event-date">${formatDate(event.dateTime)}</div>
        <div class="event-title">
            <a href="../downloads/${event.directory}/">${event.title}</a>
        </div>
        <div class="event-meta">
            <span class="rsvp-status rsvp-${event.rsvpStatus.toLowerCase()}">${event.rsvpStatus}</span>
            <span>📸 ${event.photoCount} photos</span>
            ${event.venue ? `<span>📍 ${event.venue.name}</span>` : ''}
        </div>
    </div>
    `).join('')}

</body>
</html>`;

        fs.writeFileSync(path.join(attendeesDir, `${attendee.id}.html`), attendeeHtml);
    }

    console.log(`Generated ${attendeesList.length} attendee pages`);
}

switch (process.argv[2]) {
  case 'event':
    const eventId = process.argv[3];
    await downloadMeetupEventData(eventId, 'downloads');
    console.log('Download completed successfully!');
    break;
  case 'group':
    const groupId = process.argv[3];
    await downloadMeetupGroupData(groupId);
    break;
  case 'scan':
    await scanEvents();
    break;
  default:
    console.log('Usage: node download-meetup-data.js {event|group|scan} <id>');
    console.log('Examples:');
    console.log('  node download-meetup-data.js event 123456789');
    console.log('  node download-meetup-data.js group SGV-Hikers');
    console.log('  node download-meetup-data.js scan');
    process.exit(1);
}
