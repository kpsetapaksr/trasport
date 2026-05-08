# Transport Booking Portal — QA Testing Checklist

**Project:** Transport Booking Portal (ShuttleSync)
**Generated:** 2026-04-09
**Total Test Cases:** 96
**Categories:** Functional (41) | Unit (18) | Integration (18) | Security (19) | Performance (10) | Error Handling (20)

---

## 1. FUNCTIONAL TESTS

### 1.1 Patient Portal (`/request-transport`)

| # | Test Name | Description | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| F-01 | IC Lookup — Valid IC with transport request | Search finds existing transport bookings | 1. Enter IC with existing booking 2. Click "Access Dashboard" | MONITOR step shows booking details |
| F-02 | IC Lookup — Valid IC with appointment only | Falls back to appointments collection | 1. Enter IC with appointment but no transport request 2. Click "Access Dashboard" | Shows "Appointments Found" card with patient name, date, doctor |
| F-03 | IC Lookup — Invalid IC | No records found | 1. Enter IC with no data 2. Click "Access Dashboard" | Toast: "No Bookings — We could not find any appointments or transport requests" |
| F-04 | IC Lookup — Short IC | Validation rejects < 5 chars | 1. Enter "123" 2. Click "Access Dashboard" | Toast: "Please enter a valid IC number" |
| F-05 | IC Lookup — Empty IC | Validation rejects empty | 1. Leave IC blank 2. Click "Access Dashboard" | Toast: "Please enter a valid IC number" |
| F-06 | Book Transport — Full flow | Station → Vehicle → Time Slot → Confirm | 1. Find appointment 2. Click "Book Transport" 3. Select service type 4. Select station 5. Select vehicle 6. Select time slot 7. Confirm | Toast: "Booked!" → redirects to MONITOR showing new booking |
| F-07 | Book Transport — Pickup only | Single service type booking | 1. Select "Pickup" 2. Select station, vehicle, slot 3. Confirm | Booking created with service_type='pickup' |
| F-08 | Book Transport — Drop-off only | Single service type booking | 1. Select "Drop-off" 2. Complete flow | Booking created with service_type='drop' |
| F-09 | Book Transport — Both | Round-trip booking | 1. Select "Both" 2. Complete pickup + drop selections 3. Confirm | Booking created with service_type='both', both vehicle assignments |
| F-10 | Book Transport — Missing station | Validation blocks submission | 1. Select service type 2. Select vehicle + slot but no station 3. Confirm | Toast: "Please select a pickup station" |
| F-11 | Book Transport — Missing vehicle | Validation blocks submission | 1. Select station only 2. Click Confirm | Toast: "Please select a pickup time slot and vehicle" |
| F-12 | Book Transport — Duplicate booking | Prevents double-booking same date | 1. Book transport for April 15 2. Try booking again for same IC + date | Toast error: "You already have a pickup request for this appointment date" |
| F-13 | Rebook Transport — Full flow | Cancel old + create new | 1. View cancelled booking 2. Click "Rebook Transport" 3. Select station → vehicle → time slot 4. Confirm | Old booking stays cancelled, new pending booking created |
| F-14 | Rebook — Completed trip | Cannot rebook completed trips | 1. View completed booking 2. Attempt rebook | Error: "Cannot rebook a completed trip" |
| F-15 | Monitor — Multiple bookings | Tab switching works | 1. IC with multiple bookings 2. Click different appointment tabs | Display updates to show selected booking |
| F-16 | Monitor — Confirmed with vehicle | Shows vehicle + driver card | 1. View confirmed booking with assigned vehicle | Vehicle image, driver name, phone call button shown |
| F-17 | Monitor — Pending status | Shows waiting message | 1. View pending booking | Shows "Verifying Fleet Unit Assignment..." |

### 1.2 Admin — Transport Schedule (`/transport-schedule`)

| # | Test Name | Description | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| F-18 | Create global slots — Both mode | Round-trip slot generation | 1. Click "Assign New Slots" 2. Select vehicle, type=Both 3. Set stations, times, interval 4. Deploy | Global slots created, preview matches actual |
| F-19 | Create date-specific slots | Pickup/Drop mode | 1. Click "Assign New Slots" 2. Type=Pickup, set date 3. Deploy | Date-specific slots created for that date only |
| F-20 | Delete slot — Date-specific override | Global slot deleted for one date only | 1. Navigate to April 17 2. Delete a global slot 3. Navigate to April 18 | April 17 missing the slot, April 18 still has it |
| F-21 | Delete slot — Date-specific slot | Permanent deletion | 1. Create date-specific slot 2. Delete it | Slot permanently removed |
| F-22 | Duplicate Tomorrow | Copy schedule to next day | 1. View date with slots 2. Click "Duplicate Tomorrow" 3. Navigate to next day | All slots copied to next day |
| F-23 | Stale override cleanup | Regenerating global slots cleans up orphaned overrides | 1. Create global slots 2. Delete slot on specific date (creates override) 3. Regenerate global slots with different times | Stale overrides auto-deleted |
| F-24 | Date navigation | Forward/back arrows change date | 1. Click left/right arrows | Date changes by 1 day, slots reload |
| F-25 | Search vehicles | Filter by vehicle name/number | 1. Type vehicle name in search | Only matching vehicles shown |
| F-26 | Type filter | Filter by pickup/drop/all | 1. Click Pickup/Drop/All buttons | Slots filtered accordingly |
| F-27 | Stats accuracy | Total, pickup, drop, fleet counts | 1. Create known number of slots 2. Check stats cards | Counts match exactly |

### 1.3 Admin — Fleet Operations (`/transport-requests`)

| # | Test Name | Description | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| F-28 | List all requests | Paginated list with filters | 1. Load page | All transport requests displayed with pagination |
| F-29 | Filter by status | Status dropdown filters | 1. Select "confirmed" filter | Only confirmed requests shown |
| F-30 | Filter by date | Date picker filters | 1. Select specific date | Only that date's requests shown |
| F-31 | Search by IC/name/phone | Multi-field search | 1. Type IC number in search | Matching requests shown |
| F-32 | Assign vehicle | Assign vehicle to request | 1. Select a pending request 2. Assign vehicle | Status updates, vehicle populated |
| F-33 | Update status | Change request status | 1. PATCH request with new status | Status updates correctly |

### 1.4 Admin — Vehicles, Drivers, Stations

| # | Test Name | Description | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| F-34 | Vehicle CRUD | Create, read, update, delete | Full lifecycle test | All operations succeed |
| F-35 | Duplicate plate number | Prevent duplicate vehicle numbers | 1. Create vehicle with existing plate | Error: "Plate number already registered" |
| F-36 | Driver CRUD | Create, read, update, delete | Full lifecycle test | All operations succeed |
| F-37 | Duplicate driver phone | Prevent duplicate phone | 1. Create driver with existing phone | Error: "Mobile number already registered" |
| F-38 | Station CRUD | Create, read, update, delete | Full lifecycle test | All operations succeed |

### 1.5 Driver Portal (`/driver`)

| # | Test Name | Description | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| F-39 | Driver login | Phone + password auth | 1. Enter valid phone + password | Login successful, manifest loaded |
| F-40 | Driver manifest | Daily trip list | 1. Login as driver 2. View today's trips | Correct trips for assigned vehicle shown |
| F-41 | Legacy password migration | Plaintext → bcrypt | 1. Login with plaintext password | Login succeeds, password auto-hashed |

---

## 2. UNIT TESTS

| # | Test Name | Description | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| U-01 | parseAppointmentTime — 12h format | Parse "10:00 AM - 10:10 AM" | Call with `"10:00 AM - 10:10 AM"` | Returns `600` (10*60) |
| U-02 | parseAppointmentTime — 24h format | Parse "14:00" | Call with `"14:00"` | Returns `840` (14*60) |
| U-03 | parseAppointmentTime — empty string | Handle empty | Call with `""` | Returns `null` |
| U-04 | parseAppointmentTime — malformed | Handle "99:99 AM" | Call with `"99:99 AM"` | Returns `null` or gracefully handles |
| U-05 | timeToMinutes | Convert "07:30" to minutes | Call with `"07:30"` | Returns `450` |
| U-06 | minutesToTime | Convert 450 to time string | Call with `450` | Returns `"07:30"` |
| U-07 | formatTime12h | Convert 24h to 12h | Call with `"14:30"` | Returns `"2:30 PM"` |
| U-08 | formatTime12h — midnight | Handle edge case | Call with `"00:00"` | Returns `"12:00 AM"` |
| U-09 | formatTime12h — null | Handle missing time | Call with `null` | Returns `"--:--"` |
| U-10 | IC cleaning — strip dashes | Clean IC format | `"900101-01-1234".replace(/[-\s]/g, '')` | Returns `"900101011234"` |
| U-11 | IC cleaning — regex escape | Escape special chars | Input: `"900101.*1234"` | Regex special chars escaped |
| U-12 | Duplicate filter — pickup | Correct $or for pickup | Build filter with service_type='pickup' | Includes pickup, both, null, $exists:false |
| U-13 | Duplicate filter — drop | Correct $or for drop | Build filter with service_type='drop' | Includes drop, both only |
| U-14 | Duplicate filter — both | No extra $or needed | Build filter with service_type='both' | No service_type condition (blocks any) |
| U-15 | Slot preview calculation | Preview matches deployment | Set start=07:00, end=17:00, interval=60, travel=30 | 10 pickup + 10 drop = 20 slots |
| U-16 | Doctor ID — ObjectId validation | Filter non-ObjectId strings | Test regex `/^[0-9a-fA-F]{24}$/` with "d5" | Returns false (not valid ObjectId) |
| U-17 | Doctor ID — valid ObjectId | Accept valid 24-char hex | Test with valid ObjectId string | Returns true |
| U-18 | Date override key generation | Correct composite key for override matching | Build key: `vehicleId\|type\|time\|station` | Unique key per slot identity |

---

## 3. INTEGRATION TESTS

### 3.1 Database Interactions

| # | Test Name | Description | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| I-01 | MongoDB connection | dbConnect establishes connection | 1. Call dbConnect() | Connection successful, cached for reuse |
| I-02 | Transport request creation | Full document with all fields | 1. POST /api/transport/request with all fields | Document created with correct types, indexes work |
| I-03 | Transport request — populate vehicle | Vehicle + driver populated | 1. Create request with vehicle_id 2. GET with populate | Vehicle and nested driver_id populated |
| I-04 | IC index performance | ic_number index used for lookups | 1. Query by ic_number | Explain shows index scan, not collection scan |
| I-05 | Appointment date + status index | Composite index used | 1. Query with appointment_date + status filter | Index used correctly |
| I-06 | Global + date slot query | `$in: [date, '', null]` returns both | 1. Create global slot 2. Create date-specific slot 3. Query with date | Both returned |
| I-07 | Inactive override filtering | Global slots with overrides excluded | 1. Create global slot 2. Create inactive override for date 3. GET vehicle-slots?date=X | Global slot excluded for that date |
| I-08 | Cascade behavior — vehicle deletion | Slots reference deleted vehicle | 1. Delete vehicle with assigned slots 2. Query slots | Slots still exist but vehicle_id populate returns null |
| I-09 | Concurrent duplicate check | Race condition on booking | 1. Send 2 simultaneous POST /api/transport/request for same IC+date | Only 1 should succeed (KNOWN ISSUE — race condition) |
| I-10 | Aggregation — booked seats | Correct seat counting per slot | 1. Create 3 bookings for same slot 2. GET available-slots | Booked count = 3, available = capacity - 3 |

### 3.2 API Integration

| # | Test Name | Description | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| I-11 | Book transport end-to-end | Patient flow: check appointment → book | 1. POST check-appointment 2. GET available-slots 3. POST request | Booking created, appears in GET requests |
| I-12 | Rebook end-to-end | Cancel + recreate | 1. POST rebook with old_request_id 2. Verify old cancelled 3. Verify new created | Old status=cancelled, new status=pending |
| I-13 | Slot deployment + availability | Created slots appear in available-slots | 1. POST vehicle-slots (deploy) 2. GET available-slots for same date | Slots returned with vehicle availability |
| I-14 | Delete override + availability | Override hides slot from patient | 1. Delete global slot for date X 2. GET available-slots?date=X | Slot not returned for date X |
| I-15 | Stale override cleanup integration | Regenerate global slots cleans overrides | 1. Deploy slots 2. Delete slot on date (create override) 3. Redeploy with different schedule 4. Check override exists | Override for old time deleted, override for still-valid time kept |
| I-16 | Schedule API — vehicle grouping | Trips grouped by vehicle | 1. Create bookings for multiple vehicles 2. GET /api/transport/schedule?date=X | Trips grouped correctly per vehicle |
| I-17 | Stats API accuracy | Counts match real data | 1. Create known bookings 2. GET /api/transport/stats | Counts match (total, pending, confirmed, completed) |
| I-18 | Driver manifest — correct trips | Only assigned driver's trips | 1. Assign vehicle to driver 2. Book transport on that vehicle 3. GET /api/driver/manifest?phone=X | Only that driver's trips returned |

---

## 4. SECURITY TESTS

| # | Test Name | Description | Steps | Expected Result | Severity |
|---|-----------|-------------|-------|-----------------|----------|
| S-01 | Unauthenticated API access — read | All GET endpoints accessible without auth | 1. Call GET /api/vehicles without auth headers | Returns data (VULNERABILITY) | CRITICAL |
| S-02 | Unauthenticated API access — write | POST/PUT/DELETE without auth | 1. POST /api/transport/request without auth | Creates record (VULNERABILITY) | CRITICAL |
| S-03 | Unauthenticated admin actions | Delete vehicle without auth | 1. DELETE /api/vehicles/{id} without auth | Deletes vehicle (VULNERABILITY) | CRITICAL |
| S-04 | NoSQL injection — search | Regex injection in search param | 1. GET /api/transport/requests?search=`.*` | Should be escaped — verify only escaped regex used | HIGH |
| S-05 | NoSQL injection — IC number | Special chars in IC | 1. POST check-appointment with ic_number=`{"$gt":""}` | Should reject or sanitize | HIGH |
| S-06 | NoSQL injection — status filter | Invalid status value | 1. GET /api/transport/requests?status=`{"$ne":null}` | Should treat as string, not operator | HIGH |
| S-07 | Field injection — vehicle-slots PUT | Update protected fields | 1. PUT /api/transport/vehicle-slots/{id} with `{"_id":"new","createdAt":"2020-01-01"}` | Should NOT update _id or timestamps | HIGH |
| S-08 | Field injection — station create | Extra fields in create | 1. POST /api/stations with `{"station_name":"X","__v":999,"malicious":"data"}` | Should only save whitelisted fields | MEDIUM |
| S-09 | Seed endpoint exposure | Default admin creation | 1. POST /api/auth/seed | Creates admin with admin123 (should be disabled in prod) | CRITICAL |
| S-10 | Debug endpoint exposure | Data dump endpoint | 1. GET /api/transport/debug | Should return 403 or be removed | HIGH |
| S-11 | Password brute force | Rapid login attempts | 1. Send 100 rapid POST /api/auth/login with wrong password | Account locks after 5 attempts | MEDIUM |
| S-12 | Default credentials | Login with admin/admin123 | 1. Seed admin 2. Login with admin123 | Works — must force password change | HIGH |
| S-13 | File upload — extension bypass | Double extension upload | 1. Upload file named `malware.jpg.exe` | Rejected (only last extension checked) | MEDIUM |
| S-14 | File upload — MIME type mismatch | Wrong MIME type | 1. Upload .exe renamed to .jpg | Accepted (NO MIME validation — VULNERABILITY) | HIGH |
| S-15 | File upload — large file | DoS via large upload | 1. Upload 500MB file | Should be rejected (NO size limit — VULNERABILITY) | MEDIUM |
| S-16 | XSS in patient name | Script in patient_name field | 1. Create booking with patient_name=`<script>alert(1)</script>` | Stored but React auto-escapes on render | LOW |
| S-17 | CSRF protection | Cross-site request to API | 1. Submit form from external site to POST /api/transport/request | Should be blocked (NO CSRF protection — VULNERABILITY) | HIGH |
| S-18 | Sensitive data in localStorage | Admin token exposure | 1. Inspect localStorage after admin login | Admin credentials stored in plain text (VULNERABILITY) | HIGH |
| S-19 | Driver phone in localStorage | Driver data exposure | 1. Inspect localStorage after driver login | Phone number stored unencrypted | MEDIUM |

---

## 5. PERFORMANCE TESTS

| # | Test Name | Description | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| P-01 | Slot availability — many bookings | Performance with 1000+ bookings on same date | 1. Seed 1000 bookings for one date 2. GET available-slots | Response < 2s, aggregation uses indexes |
| P-02 | Transport requests — large dataset | Pagination with 10,000+ records | 1. Seed 10,000 requests 2. GET /api/transport/requests?page=1&limit=50 | Response < 1s, correct pagination |
| P-03 | Search with regex — large dataset | Regex search performance | 1. Seed 10,000 requests 2. Search by IC number | Response < 2s, ic_number index used |
| P-04 | Drivers/Vehicles — no pagination | All records returned at once | 1. Create 1000 drivers 2. GET /api/drivers | Response time degrades (KNOWN ISSUE — no pagination) |
| P-05 | Slot deployment — bulk create | Creating 100+ slots in one POST | 1. Deploy with interval=5min, range 07:00-22:00 | All slots created in < 3s |
| P-06 | Override filtering — many overrides | Filter performance with 100+ overrides | 1. Create 100 date-specific overrides 2. GET vehicle-slots?date=X | Response < 1s |
| P-07 | Check-appointment — doctor lookup | Multiple appointments with doctors | 1. Create 50 appointments 2. POST check-appointment | Response < 2s, doctor population works |
| P-08 | Concurrent bookings | 50 simultaneous booking requests | 1. Send 50 concurrent POST /api/transport/request | No server crash, correct duplicate handling |
| P-09 | MongoDB connection pooling | Connection reuse under load | 1. Send 100 rapid sequential API calls | Connection cached, no pool exhaustion |
| P-10 | Populate chain — deep nesting | Vehicle → Driver populate performance | 1. GET /api/transport/requests with 100 records, all populated | Response < 3s |

---

## 6. ERROR HANDLING TESTS

| # | Test Name | Description | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| E-01 | Missing required fields — transport request | ic_number, patient_name, phone, date missing | 1. POST /api/transport/request with empty body | 400: "Missing required fields" |
| E-02 | Missing pickup station | Pickup service without station | 1. POST with service_type=pickup, no pickup_station | 400: "Pickup station is required for pickup service" |
| E-03 | Missing dropoff station | Drop service without station | 1. POST with service_type=drop, no dropoff_station | 400: "Drop-off station is required for drop service" |
| E-04 | Invalid ObjectId — vehicle slot | Non-existent slot ID | 1. DELETE /api/transport/vehicle-slots/invalidid | 500 or 404 error (not crash) |
| E-05 | Invalid ObjectId — transport request | Non-existent request ID | 1. PATCH /api/transport/invalidid | 404: "Request not found" |
| E-06 | Rebook — missing old_request_id | No reference to old booking | 1. POST /api/transport/rebook with empty body | 400: "old_request_id is required" |
| E-07 | Rebook — non-existent request | Invalid old_request_id | 1. POST rebook with fake ID | 404: "Original transport request not found" |
| E-08 | Check-appointment — missing IC | No IC number provided | 1. POST /api/transport/check-appointment with empty body | 400: "IC number is required" |
| E-09 | Check-appointment — invalid doctor ID | doctorId not valid ObjectId (e.g., "d5") | 1. Appointment with doctorId="d5" 2. POST check-appointment | Returns data without crash (fixed) |
| E-10 | Available-slots — missing date | No date parameter | 1. GET /api/transport/available-slots | 400: "date parameter is required" |
| E-11 | Available-slots — no slots configured | Date with no slots | 1. GET available-slots?date=2030-01-01 | Empty slots array with message |
| E-12 | Available-slots — service disabled | Transport settings disabled | 1. Set settings.enabled=false 2. GET available-slots | Empty with "service unavailable" message |
| E-13 | Vehicle-slots POST — missing fields | Incomplete deployment config | 1. POST vehicle-slots without vehicle_id | 400: "vehicle_id, type... are required" |
| E-14 | Vehicle-slots POST — invalid time range | start_time after end_time | 1. POST with start_time=18:00, end_time=07:00 | 400: "Invalid time range or interval" |
| E-15 | Vehicle-slots POST — both mode missing stations | Missing pickup/drop stations | 1. POST type=both without pickup_station | 400: "pickup_station... required for both mode" |
| E-16 | Duplicate Tomorrow — no slots | Copy empty schedule | 1. Navigate to empty date 2. Click Duplicate Tomorrow | Button disabled, no action |
| E-17 | Duplicate Tomorrow — same date | Edge case validation | 1. PUT vehicle-slots with source=target | 400: "Source and target dates must be different" |
| E-18 | MongoDB disconnection | Database unavailable | 1. Disconnect MongoDB 2. Call any API | 500 error with message (not unhandled crash) |
| E-19 | Malformed JSON body | Invalid request body | 1. POST with `{invalid json` | 500 or 400 error (not crash) |
| E-20 | Empty appointment result | IC with no upcoming appointments | 1. POST check-appointment with IC that has only past appointments | `{ found: false, message: "No upcoming appointment found" }` |

---

## KNOWN ISSUES & VULNERABILITIES

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| KI-01 | No server-side authentication on any API route | CRITICAL | Open |
| KI-02 | Client-side only auth via localStorage | CRITICAL | Open |
| KI-03 | Seed/Debug endpoints exposed in production | CRITICAL | Open |
| KI-04 | No CSRF protection | HIGH | Open |
| KI-05 | No file upload size limit or MIME validation | HIGH | Open |
| KI-06 | No rate limiting on login endpoints | MEDIUM | Open |
| KI-07 | Race condition on concurrent duplicate booking check | MEDIUM | Open |
| KI-08 | No pagination on drivers/vehicles/stations GET | MEDIUM | Open |
| KI-09 | Legacy plaintext password support in driver auth | MEDIUM | Open |
| KI-10 | Admin credentials in plain localStorage | HIGH | Open |
| KI-11 | Field injection possible via unwhitelisted $set updates | HIGH | Open |
| KI-12 | Default admin password admin123 | HIGH | Open |

---

## TEST EXECUTION SUMMARY

| Category | Total | Pass | Fail | Blocked | Not Run |
|----------|-------|------|------|---------|---------|
| Functional Tests | 41 | | | | |
| Unit Tests | 18 | | | | |
| Integration Tests | 18 | | | | |
| Security Tests | 19 | | | | |
| Performance Tests | 10 | | | | |
| Error Handling Tests | 20 | | | | |
| **TOTAL** | **96** | | | | |

**Tested By:** _______________
**Date:** _______________
**Environment:** localhost:3000 / MongoDB Atlas
**Sign-off:** _______________
