# User Acceptance Test Plan
## Daily Dev Mix - CSCI 3308

---

## Test Environment
All tests will be conducted on the cloud hosted Railway website using it's incorportated environment variables and database.

## Testers
CU Boulder CSCI 3308 students acting as target users of the Daily Dev Mix application.

---

## Feature 1: User Spotify Login

### Description
A user can log in using their Spotify account via OAuth, connecting their Spotify data to the app.

### Test Cases

#### Test Case 1.1 - Positive: Valid Spotify Login
- **Test Data:** Valid Spotify account credentials
- **Steps:** Navigate to /login, click "Connect with Spotify", authorize the app on Spotify's login page
- **Expected Result:** User is redirected back to the app and logged in successfully
- **Actual Result:** 

#### Test Case 1.2 - Negative: Cancelled Spotify Login
- **Test Data:** Invalid Spotify account credentials
- **Steps:** Navigate to /login, click "Connect with Spotify", cancel the login process on Spotify's login page
- **Expected Result:** User is redirected back to the app with an error message and is not logged in
- **Actual Result:** 

---

## Feature 2: Tracking a Listening Session

### Description
A logged in user can start a listening session, which tracks the songs they listen to during that session and displays them on the dashboard.

### Test Cases

#### Test Case 2.1 - Positive: Succesful Session Tracking
- **Test Data:** Valid Spotify account credentials and a listening session with multiple songs played
- **Steps:** Navigate to /login, click "Connect with Spotify", authorize the app on Spotify's login page, select "Start Listening Session" and then play multiple songs on Spotify account
- **Expected Result:** The dashboard updates in real-time to show the songs being played during the session
- **Actual Result:** 

#### Test Case 2.2 - Negative: No Music Played During Session
- **Test Data:** Valid Spotify account credentials
- **Steps:** Navigate to /login, click "Connect with Spotify", authorize the app on Spotify's login page, select "Start Listening Session" but do not play any songs
- **Expected Result:** The dashboard shows an empty session or a message indicating no songs were played
- **Actual Result:** 

---

## Feature 3: Playlist Generation from Listening Session

### Description
After a listening session the app generates the user a playlist based on the songs played during that session, which is then added to their Spotify account.

### Test Cases

#### Test Case 3.1 - Positive: Successful Playlist Generation
- **Test Data:** A completed listening session with multiple songs
- **Steps:** Complete a listening session with multiple songs played
- **Expected Result:** The app generates a playlist based on the songs played and adds it to the user's Spotify account
- **Actual Result:** 

#### Test Case 3.2 - Negative: No Songs in Session
- **Test Data:** A completed listening session with no songs played
- **Steps:** Complete a listening session without playing any songs
- **Expected Result:** The app displays a message indicating no songs were played and does not generate a playlist
- **Actual Result:** 

---
## Feature 4: Logout of Spotify Account
### Description
A logged in user can log out of their Spotify account using th logout button, which will disconnect their Spotify data from the app and redirect them to the landing page.
### Test Cases
#### Test Case 4.1 - Positive: Successful Logout
- **Test Data:** A logged in user with a connected Spotify account
- **Steps:** Click the "Logout" button on the dashboard
- **Expected Result:** User is logged out, Spotify data is disconnected, and user is redirected to the landing page
- **Actual Result:**

----
## Feature 5: Create custom "vibe"
### Description
A logged in user can create a custom "vibe" by selecting the create button on the dashboard, prompting them to select a name and emoji for their "vibe" category, which will then be added to their dashboard and can be used to categorize their listening sessions.
### Test Cases
#### Test Case 5.1 - Positive: Successful Vibe Creation
- **Test Data:** A logged in user with a connected Spotify account, entering a valid vibe name and selecting an emoji option
- **Steps:** Click the "Create Vibe" button on the dashboard, enter a valid vibe name and select an emoji, then save the vibe
- **Expected Result:** The new vibe is created and added to the user's dashboard, allowing them to categorize their listening sessions under that vibe
- **Actual Result:**
#### Test Case 5.2 - Negative: Invalid Vibe Creation
- **Test Data:** A logged in user with a connected Spotify account, entering an invalid vibe name (e.g., empty string) or not selecting an emoji
- **Steps:** Click the "Create Vibe" button on the dashboard, enter an invalid vibe name or fail to select an emoji, then attempt to save the vibe
- **Expected Result:** The app displays an error message indicating that the vibe name is invalid or that an emoji must be selected, and the vibe is not created
- **Actual Result:** 