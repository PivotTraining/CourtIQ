# Georgia high-school gym arrival reminders

## Goal

When a CourtIQ mobile user arrives at a Georgia high-school basketball campus, show a local reminder such as:

> You're at North Gwinnett High School. Open CourtIQ to start Gametime or record video.

## Why this cannot be a browser-only feature

The CourtIQ public beta is currently a browser/PWA product. Browser geolocation can read location only while the site is running with permission. The web Geofencing API was discontinued and cannot reliably wake a closed PWA when a user crosses a geographic boundary.

The arrival reminder therefore requires a native iOS/Android CourtIQ shell.

## Native design

- Use the public `/api/gym-campuses` endpoint for Georgia public, non-virtual regular schools that serve grades 9-12.
- Coordinates are NCES school-campus points. They are a practical campus proxy, not a verified gym-door coordinate.
- Default boundary radius: 300 meters.
- Ask for location and notification permissions only after the user explicitly enables **Gym arrival reminders**.
- Compute the nearest campuses on-device. Do not upload continuous user location merely to choose geofences.
- iOS: register only the nearest 20 campus regions because Core Location limits an app to 20 simultaneously monitored regions.
- Android: register only the nearest 100 because the Android geofencing API caps a user/app at 100.
- Refresh the registered set when the app launches and after meaningful location movement so travel games can rotate new campuses into the monitored set.
- On entry, post a local notification and deep-link to CourtIQ Gametime / Film Lab.
- Do not notify repeatedly while a user remains inside the same campus. Use an entry cooldown.

## Data source

NCES EDGE Public School Administrative Data 2024-25:
https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_ADMINDATA_PUBLICSCH_2425/MapServer/1

The endpoint is public government school-location data. The CourtIQ API filters to active, non-virtual, regular Georgia schools serving at least one high-school grade.
