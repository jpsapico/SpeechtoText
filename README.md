# SpeechtoText
Welcome!

This is speech to text using Google's Cloud Speech-to-Text API in nodejs.

A few reminders before running this project.
1. Install sox-14.4.1-win32.exe (https://sourceforge.net/projects/sox/files/sox/14.4.1/)
2. Make sure you have a GCP project and enable Cloud Speech-to-Text API
3. Create a service account and download the private key as JSON
4. The main code that you will run is under js/googlespeech.js while the original code (index.js) came from the ff below: (so make sure to read those firsts)
- https://cloud.google.com/speech-to-text/docs/endless-streaming-tutorial
- https://github.com/googleapis/nodejs-speech/blob/main/samples/infiniteStreaming.js
