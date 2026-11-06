// Answers reflect the existing authentication, Operations, passenger attendance
// and GPS workflows. Support itself does not change those permissions or actions.
export const supportFaqs = [
  { category: 'Account & Login', items: [
    ['How do I log in to my account?', 'Open the web portal, choose Sign In, and enter your registered email and password. Use an active, confirmed account assigned to the correct portal.'],
    ['What should I do if I forget my password?', 'Choose Forgot password on the sign-in page. Enter your registered email, verify the code sent to that address, and set a new password. Check your spam folder if the message is missing.'],
    ['How can I change my account password?', 'If your portal Settings includes Password, enter your current password and confirm the new one there. Otherwise use Forgot password on the sign-in page. Never include passwords or verification codes in a support request.'],
    ["Why can’t I access certain portal features?", 'Access depends on your assigned role and, where relevant, account, boat or document approval. Sign in with the correct account. Ask your administrator to check your access if a feature you need is unavailable.'],
  ] },
  { category: 'Trips & Bookings', items: [
    ['How can I create or schedule a trip?', 'Boat owners can use My Trips to schedule a future trip with an approved vessel, valid documents and available certified crew. Complete the required details and review any validation message before submitting.'],
    ['How can I check the status of a trip?', 'Open your portal’s trip list and select the trip. Its status shows the current stage, such as Scheduled, Boarding, Ongoing, Completed or NeedsReschedule. Available trips and actions depend on your role.'],
    ['Can I modify or cancel a scheduled trip?', 'Boat owners can reschedule eligible trips and change assigned crew before departure. Cancel Trip is available for Scheduled or Boarding trips, and registered passenger records are retained. Use the actions shown on the trip page; contact the Shore Officer or administrator if the action you need is unavailable.'],
    ['What happens if a trip requires approval?', 'Check the specific status and any pending vessel or document approvals. Passenger confirmation must be finalized before an authorized Shore Officer or administrator can start the trip. Wildlife monitoring and signatures do not by themselves authorize departure.'],
  ] },
  { category: 'Passengers & Registration', items: [
    ['How are passengers registered for a trip?', 'Use the trip invitation link or QR code supplied by the operator. New passengers enter their details; returning passengers can use their existing identification details. Registration is subject to trip availability and capacity.'],
    ['Can passengers be registered without using the passenger portal?', 'The operator can help a passenger open the trip invitation and complete registration. Shore staff can confirm already registered passengers manually when scanning is unavailable. Manual attendance confirmation does not create a new passenger registration.'],
    ['How does QR-based passenger verification work?', 'Passengers present their personal QR code to the Shore Officer. The officer scans it, reviews the passenger group and confirms attendance for the selected trip. The officer can also find registered passengers manually before finalizing confirmation.'],
  ] },
  { category: 'GPS & Boat Monitoring', items: [
    ["Why isn’t my boat’s location updating?", 'Check the displayed GPS time and tracking status. Updates depend on the vessel’s tracker, connectivity and the configured GPS provider. A stale or offline marker is not a new position; record the vessel and last update time when reporting the issue.'],
    ['What should I do if GPS tracking is unavailable?', 'Refresh the monitoring view and check your connection. If the issue continues, notify Operations or your administrator with the vessel registration, trip and last known update time. Follow established safety procedures rather than relying on an unavailable location feed.'],
    ['How can I view trip routes and tracking history?', 'Authorized Operations users can select a trip in Monitor to view tracking. SLTDA can open a trip’s monitoring page for the recorded GPS route, timestamps and distance when samples are available. A route cannot be reconstructed if no positions were recorded.'],
    ['How do I report an emergency or SOS incident?', 'Assigned boat crew can open an ongoing trip, choose SOS, and confirm the alert. Operations can review SOS incidents and record response actions. Follow your established emergency procedures; this support form is for assistance and is not an emergency dispatch channel.'],
  ] },
  { category: 'General Support', items: [
    ['How can I report a technical issue?', 'Use the form below. Include your portal, what you were trying to do, the page or trip reference, the approximate time and the error message. Describe the steps that reproduce the problem without including passwords or sensitive passenger details.'],
    ['Who should I contact if I encounter a system error?', 'Submit a Technical Problems request below, or notify your WWMS administrator if the error prevents you from continuing. Keep the support reference shown after submission so your request can be identified.'],
  ] },
];
