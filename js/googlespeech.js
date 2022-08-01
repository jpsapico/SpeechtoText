const express = require('express') // install express (npm i express)
const app = express()
const path = require('path'); //this is for index.html 

app.use(express.static(path.join(__dirname, 'public')));

//for rendering purposes
app.engine("html", require("ejs").renderFile); // install ejs (npm install ejs)
app.set("view engine", "html");
app.set('views', path.join(__dirname, "../front-end/views"));
app.use(express.json());
app.listen(7000) // any port would do

function main(
    encoding = 'LINEAR16',
    sampleRateHertz = 16000,
    languageCode = 'en-US',
    streamingLimit = 290000
  ) {
    // [START speech_transcribe_infinite_streaming]
   
  //    const encoding = 'LINEAR16';
  //    const sampleRateHertz = 16000;
  //    const languageCode = 'en-US';
  //    const streamingLimit = 10000; // ms - set to low number for demo purposes
   
    const chalk = require('chalk'); //install version 4.1.2
    const {Writable} = require('stream');
    const recorder = require('node-record-lpcm16');
   
    // Imports the Google Cloud client library
    // Currently, only v1p1beta1 contains result-end-time
    const speech = require('@google-cloud/speech').v1p1beta1; // install google cloud speech api (npm i @google-cloud/speech)
   
    const client = new speech.SpeechClient();
   
    const config = {
      encoding: encoding,
      sampleRateHertz: sampleRateHertz,
      languageCode: languageCode,
    };
   
    const request = {
      config,
      interimResults: true,
    };
   
    let recognizeStream = null;
    let restartCounter = 0;
    let audioInput = [];
    let lastAudioInput = [];
    let resultEndTime = 0;
    let isFinalEndTime = 0;
    let finalRequestEndTime = 0;
    let newStream = true;
    let bridgingOffset = 0;
    let lastTranscriptWasFinal = false;
    var holder = ''; // this is a variable for the text output that will be thrown to index.html
   
    function startStream() {
      // Clear current audioInput
      audioInput = [];
      // Initiate (Reinitiate) a recognize stream
      recognizeStream = client
        .streamingRecognize(request)
        .on('error', err => {
          if (err.code === 11) {
            // restartStream();
          } else {
            console.error('API request error ' + err);
          }
        })
        .on('data', speechCallback);
  
      // Restart stream when streamingLimit expires
      setTimeout(restartStream, streamingLimit);
    }
   
    const speechCallback = stream => {
      // Convert API result end time from seconds + nanoseconds to milliseconds
      resultEndTime =
        stream.results[0].resultEndTime.seconds * 1000 +
        Math.round(stream.results[0].resultEndTime.nanos / 1000000);
   
      // Calculate correct time based on offset from audio sent twice
      const correctedTime =
        resultEndTime - bridgingOffset + streamingLimit * restartCounter;

    // convert milliseconds to minutes and seconds
    const millisToMinutesAndSeconds = (millis) => {
        var minutes = Math.floor(millis / 60000);
        var seconds = ((millis % 60000) / 1000).toFixed(0);
        //ES6 interpolated literals/template literals 
          //If seconds is less than 10 put a zero in front.
        return `${minutes}:${(seconds < 10 ? "0" : "")}${seconds}`;
    }
    let minsSec = millisToMinutesAndSeconds(correctedTime);

      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      let stdoutText = '';
      if (stream.results[0] && stream.results[0].alternatives[0]) {
        stdoutText =
        //   correctedTime + ': ' + stream.results[0].alternatives[0].transcript; // ORIGINAL
        minsSec + ': ' + stream.results[0].alternatives[0].transcript; // /w min and sec
      }
   
      if (stream.results[0].isFinal) {
        process.stdout.write(chalk.green(`${stdoutText}\n`));
        holder +=(stdoutText + '<br/>')

        app.get('/', (req, res) => {
          var loc = path.join(__dirname, '../' + '/front-end/views/index.html')
          res.render(loc, {holder:holder});
        })
   
        isFinalEndTime = resultEndTime;
        lastTranscriptWasFinal = true;
      } else {
        // Make sure transcript does not exceed console character length
        if (stdoutText.length > process.stdout.columns) {
          stdoutText =
            stdoutText.substring(0, process.stdout.columns - 4) + '...';
        }
        process.stdout.write(chalk.red(`${stdoutText}`));
   
        lastTranscriptWasFinal = false;
      }
    };
   
    const audioInputStreamTransform = new Writable({
      write(chunk, encoding, next) {
        if (newStream && lastAudioInput.length !== 0) {
          // Approximate math to calculate time of chunks
          const chunkTime = streamingLimit / lastAudioInput.length;
          if (chunkTime !== 0) {
            if (bridgingOffset < 0) {
              bridgingOffset = 0;
            }
            if (bridgingOffset > finalRequestEndTime) {
              bridgingOffset = finalRequestEndTime;
            }
            const chunksFromMS = Math.floor(
              (finalRequestEndTime - bridgingOffset) / chunkTime
            );
            bridgingOffset = Math.floor(
              (lastAudioInput.length - chunksFromMS) * chunkTime
            );
   
            for (let i = chunksFromMS; i < lastAudioInput.length; i++) {
              recognizeStream.write(lastAudioInput[i]);
            }
          }
          newStream = false;
        }
   
        audioInput.push(chunk);
   
        if (recognizeStream) {
          recognizeStream.write(chunk);
        }
   
        next();
      },
   
      final() {
        if (recognizeStream) {
          recognizeStream.end();
        }
      },
    });
   
    function restartStream() {
      if (recognizeStream) {
        recognizeStream.end();
        recognizeStream.removeListener('data', speechCallback);
        recognizeStream = null;
      }
      if (resultEndTime > 0) {
        finalRequestEndTime = isFinalEndTime;
      }
      resultEndTime = 0;
   
      lastAudioInput = [];
      lastAudioInput = audioInput;
  
      restartCounter++;
   
      if (!lastTranscriptWasFinal) {
        process.stdout.write('\n');
      }
      process.stdout.write(
        chalk.yellow(`${streamingLimit * restartCounter}: RESTARTING REQUEST\n`)
      );
   
      newStream = true;
   
      startStream();
    }
    // Start recording and send the microphone input to the Speech API
    recorder
      .record({
        sampleRateHertz: sampleRateHertz,
        threshold: 0, // Silence threshold
        silence: 1000,
        keepSilence: true,
        recordProgram: 'rec', // Try also "arecord" or "sox"
      })
      .stream()
      .on('error', err => {
        console.error('Audio recording error ' + err);
      })
      .pipe(audioInputStreamTransform);
   
    console.log('\nServer running on port 7000\n'); // Open browser to localhost:7000
    console.log('Listening, press Ctrl+C to stop.\n');
    console.log('End (ms)       Transcript Results/Status');
    console.log('=========================================================');
   
    startStream();
    // [END speech_transcribe_infinite_streaming]
  }
   
  process.on('unhandledRejection', err => {
    console.error(err.message);
    process.exitCode = 1;
  });
   
  main(...process.argv.slice(2));