# LLM Agent API Examples

This directory contains examples demonstrating how to use the websocket modality of the Aplisay LLM Agent API.

## WebSocket Monitor Example

This example shows how to:
1. Create an agent
2. Activate it for websocket connections
3. Join a websocket room
3. Receive and send binary audio data from/to the speaker in node.js
4. Clean up resources properly

### Prerequisites

- Node.js (v20 or higher)
- Access to an LLM Agent API server (default: http://localhost:5000/api)
- API key for authentication

### Installation

1. Install dependencies:
```bash
yarn install
```

2. Configure the API key:
   - Create a `.env` file in the examples directory if it doesn't exist
   - Add your API key to the `.env` file:
     ```
     API_KEY="your-api-key-here"
     ```
   - The example uses this key for bearer authentication with the API

### Usage

Run the WebSocket monitor example:
```bash
yarn start
```

The example will:
1. Get available models from the API
2. Create an agent using the first available model
3. Activate the agent for WebRTC/websocket connections
4. Get room join information
5. Connect to the websocket
6. Read and write audio for 60 seconds
7. Clean up by deleting the listener and agent


### API Endpoints Used

- `GET /models` - Get available models
- `POST /agents` - Create a new agent
- `POST /agents/{agentId}/listen` - Activate an agent
- `POST /rooms/{listenerId}/join` - Get join information for a room
- `DELETE /agents/{agentId}/listen/{listenerId}` - Delete a listener
- `DELETE /agents/{agentId}` - Delete an agent

### Authentication

The example uses bearer authentication with an API key. The key should be stored in a `.env` file in the examples directory. The API client automatically includes the key in the `Authorization` header for all requests.

### Error Handling

The example includes error handling:
- API call errors are caught and logged
- WebSocket connection errors are handled
- Resources are properly cleaned up in case of errors
- Graceful shutdown on completion or error 