require('dotenv').config();
const axios = require('axios');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const Speaker = require('speaker');
let Mic = require('node-microphone');



// Create the Speaker instance
const speaker = new Speaker({
  channels: 1,          // 1 channel
  bitDepth: 16,         // 8-bit samples
  sampleRate: 48000     // 48 kHz sample rate
});

let microphone = new Mic({
  bitwidth: 16,
  rate: 48000,
  channels: 1,
  useDataEmitter: true
});



// Base URL for the API
const API_BASE_URL = 'http://localhost:5000/api';

// Hardcode the API key temporarily for testing
const { API_KEY } = process.env;

// Create an axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  }
});

// Debug: Log the full authorization header
console.log('Authorization header:', `Bearer ${API_KEY.substring(0, 10)}...`);

// Create a temporary directory for audio files
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

/**
 * Get available models from the API
 */
async function getModels() {
  try {
    const response = await api.get('/models');
    console.log('Available models:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting models:', error.message);
    throw error;
  }
}

/**
 * Create a new agent
 * @param {string} modelName - The model to use (e.g., 'gpt35')
 * @param {string} prompt - The prompt for the agent
 * @param {object} options - Additional options for the agent
 */
async function createAgent(modelName, prompt, options = {}) {
  try {
    const agentData = {
      modelName,
      prompt,
      options: {
        temperature: 0.7,
        ...options
      }
    };
    const response = await api.post('/agents', agentData);
    console.log('Agent created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating agent:', error.message);
    throw error;
  }
}

/**
 * Activate an agent to listen for calls or WebRTC connections
 * @param {string} agentId - The ID of the agent to activate
 * @param {object} options - Activation options
 */
async function activateAgent(agentId, options = {}) {
  try {
    const activationData = {
      websocket: true, // Use WebRTC/websocket instead of phone number
      options: {
        streamLog: true, // Enable debug transcript
        ...options
      }
    };

    const response = await api.post(`/agents/${agentId}/listen`, activationData);
    console.log('Agent activated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error activating agent:', { error });
    throw error;
  }
}

/**
 * Get join information for a room
 * @param {string} listenerId - The ID of the listener
 * @param {object} options - Join options
 */
async function joinRoom(listenerId, options = {}) {
  try {
    const joinData = {
      options: {
        streamLog: true,
        ...options
      }
    };

    const response = await api.post(`/rooms/${listenerId}/join`, joinData);
    console.log('Room join info:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error joining room:', error.message);
    throw error;
  }
}

/**
 * Delete a listener
 * @param {string} agentId - The ID of the agent
 * @param {string} listenerId - The ID of the listener to delete
 */
async function deleteListener(agentId, listenerId) {
  try {
    const response = await api.delete(`/agents/${agentId}/listen/${listenerId}`);
    console.log('Listener deleted');
    return response.data;
  } catch (error) {
    console.error('Error deleting listener:', error.message);
    throw error;
  }
}

/**
 * Delete an agent
 * @param {string} agentId - The ID of the agent to delete
 */
async function deleteAgent(agentId) {
  try {
    const response = await api.delete(`/agents/${agentId}`);
    console.log('Agent deleted');
    return response.data;
  } catch (error) {
    console.error('Error deleting agent:', error.message);
    throw error;
  }
}

/**
 * Play audio data through the host speakers
 * @param {Buffer} audioData - The audio data to play
 */
async function playAudio(audioData) {
  try {
    console.log('Playing audio data:', { length: audioData.length, speaker, ready: speaker.ready });
    if (speaker) {
      speaker.ready && await speaker.ready;
      await speaker.write(audioData);
      console.log("Data written to speaker.");
    }
    else {
      console.log('Speaker not active (closing connection?)');
    }
  }
  catch (error) {
    console.error("Speaker error:", err);
  }
}


/**
 * Connect to the audio WebSocket
 * @param {string} socketUrl - The WebSocket URL
 * @returns {Promise<WebSocket>} - The WebSocket connection
 */
function connectToAudioSocket(socketUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(socketUrl);

    ws.on('open', () => {
      console.log('Connected to audio WebSocket');
      microphone.startRecording();
      microphone.on('data', (data) => {
        console.log('Received microphone data:', { data });
        ws.send(data);
      });
      resolve(ws);
    });

    ws.on('message', (data, isBinary) => {
      try {
        // Check if the data is a text message or binary audio data
        if (!isBinary) {
          try {
            const message = JSON.parse(data);
            console.log('Received text message:', message);
          } catch (e) {
            console.log('Received text data:', data);
          }
        } else {
          // Binary data is audio
          console.log(`Received audio data: ${data.length} bytes`);

          // Examine the first few bytes to determine the format
          const header = data.slice(0, 4);
          console.log('Audio data header:', header);
          console.log('Header as string:', header.toString());
          console.log('Header as hex:', header.toString('hex'));

          // Play the audio
          playAudio(data);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('Audio WebSocket error:', error);
      reject(error);
    });

    ws.on('close', () => {
      console.log('Audio WebSocket connection closed');
    });
  });
}

/**
 * Main function to demonstrate the API usage with audio WebSocket
 */
async function main() {
  let audioWs = null;
  let agentId = null;
  let listenerId = null;

  try {
    // Step 1: Get available models
    const models = await getModels();

    // Step 2: Create an agent
    const modelName = Object.keys(models).find(model => model.match(/ultravox-70B/)); // Use the first available model
    const prompt = `You are a helpful AI assistant. You can help users with various tasks.
    Be concise and friendly in your responses.`;

    const agent = await createAgent(modelName, prompt);
    agentId = agent.id;

    // Step 3: Activate the agent
    const activation = await activateAgent(agentId);
    listenerId = activation.id;

    // Step 4: Get room join information
    const roomInfo = await joinRoom(listenerId);

    console.log('Agent is ready!');
    console.log('To connect to the agent:');
    console.log('- Audio websocket: ', roomInfo.audioSocket);

    // Step 5: Connect to the audio WebSocket
    if (roomInfo.audioSocket) {
      console.log('Connecting to audio WebSocket:', roomInfo.audioSocket.url);
      audioWs = await connectToAudioSocket(roomInfo.audioSocket.url);

    } else {
      console.log('No audio WebSocket available');
    }

    // Keep the agent running for a while
    console.log('Agent will run for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60 * 1000));

    // Step 6: Clean up
    if (audioWs) {
      audioWs.close();
    }

    if (microphone) {
      microphone.stopRecording();
    }

    if (speaker) {
      if (speaker.ready) {
        await speaker.ready;
      }
      speaker.close();
    }

    if (listenerId) {
      await deleteListener(agentId, listenerId);
    }

    if (agentId) {
      await deleteAgent(agentId);
    }


    console.log('Demo completed successfully!');
  } catch (error) {
    console.error('Error in main function:', error.message);

    // Clean up on error
    if (audioWs) {
      audioWs.close();
    }

    if (microphone) {
      microphone.stopRecording();
    }

    if (speaker) {
      if (speaker.ready) {
        await speaker.ready;
      }
      speaker.close();
    }

    if (listenerId && agentId) {
      try {
        await deleteListener(agentId, listenerId);
      } catch (e) {
        console.error('Error cleaning up listener:', e.message);
      }
    }

    if (agentId) {
      try {
        await deleteAgent(agentId);
      } catch (e) {
        console.error('Error cleaning up agent:', e.message);
      }
    }
  }
}

// Run the main function
main(); 