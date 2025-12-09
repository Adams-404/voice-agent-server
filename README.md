# Voice Agent Server

A Node.js/Express backend server designed to manage AI voice assistants and phone numbers programmatically. This application integrates with **Vapi.ai** for voice orchestration, using **Google's Gemini** (specifically `gemini-2.5-pro`) for intelligence and **ElevenLabs** for speech synthesis by default.

It features a local JSON-based database for persistence and is pre-configured for deployment on [Fly.io](https://fly.io).

## 🚀 Features

* **Assistant Management**: Create, update, delete, and retrieve AI assistants.
* **Phone Number Management**: Provision and manage Vapi phone numbers.
* [cite_start]**Vapi Integration**: Automatically syncs local assistant configurations with the Vapi platform using the `@vapi-ai/server-sdk`[cite: 1].
* **Local Persistence**: Uses a lightweight JSON file (`data.json`) to store assistant and phone number metadata locally.
* **TypeScript Support**: Built with TypeScript for type safety and developer experience.

## 🛠️ Tech Stack

* **Runtime**: Node.js (v22.18.0)
* [cite_start]**Framework**: Express.js [cite: 1]
* **Language**: TypeScript
* **Voice Orchestration**: Vapi.ai SDK
* [cite_start]**Deployment**: Docker & Fly.io [cite: 2, 3]

---

## 📋 Prerequisites

Before running the server, ensure you have the following:

* **Node.js** (v18 or higher recommended)
* **npm**
* **Vapi API Key**: You can obtain this from the [Vapi Dashboard](https://dashboard.vapi.ai).

---

## ⚙️ Installation & Local Setup

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/Adams-404/voice-agent-server](https://github.com/Adams-404/voice-agent-server)
    cd voice-agent-server
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env` file in the root directory and add your Vapi Private Key:
    ```env
    VAPI_API_KEY=your_vapi_private_api_key_here
    ```

4.  **Run the Server**
    * [cite_start]**Development Mode** (with hot-reload)[cite: 1]:
        ```bash
        npm run dev
        ```
    * [cite_start]**Production Build**[cite: 1]:
        ```bash
        npm run build
        npm start
        ```

The server will start on port `3000` by default.

---

## 📖 API Documentation

### 🤖 Assistants

| Method | Endpoint | Description | Body Params (JSON) |
| :--- | :--- | :--- | :--- |
| **GET** | `/assistants` | List all assistants | - |
| **POST** | `/assistants` | Create a new assistant | `name`, `firstMessage`, `systemPrompt` (optional) |
| **GET** | `/assistants/:id` | Get assistant details | - |
| **PATCH** | `/assistants` | Update an assistant | `id`, `name`, `firstMessage`, `systemPrompt`, `voiceProvider`, `voiceId`, `phoneNumberId` |
| **DELETE** | `/assistants` | Delete an assistant | `id` |

*Note: Creating an assistant defaults to using **Google's `gemini-2.5-pro`** and ElevenLabs voice ID `DwwuoY7Uz8AP8zrY5TAo` unless specified otherwise.*

### 📞 Phone Numbers

| Method | Endpoint | Description | Body Params (JSON) |
| :--- | :--- | :--- | :--- |
| **GET** | `/phone-numbers` | List all numbers | - |
| **POST** | `/phone-numbers` | Buy/Create a number | `name`, `assistantId` (optional) |
| **GET** | `/phone-numbers/:id` | Get number details | - |
| **PATCH** | `/phone-numbers` | Update number | `id`, `assistantId` |
| **DELETE** | `/phone-numbers` | Release a number | `id` |

*Note: New numbers are currently hardcoded to request area code `207`. This is intentional because numbers with Nigerian area codes (like +234) or other regions often incur costs, whereas `207` numbers are typically available on the Vapi free/test tier.*

---

## ☁️ Deployment (Fly.io)

This project is pre-configured with a `fly.toml` file and `Dockerfile` for easy deployment on Fly.io.

1.  **Install Fly CLI**
    If you haven't already, install the [flyctl CLI](https://fly.io/docs/hands-on/install-flyctl/).

2.  **Launch the App**
    Initialize the app (this will generate a new `fly.toml` if you don't use the existing one):
    ```bash
    fly launch
    ```

3.  **Set Secrets**
    You must set your Vapi API key in the production environment:
    ```bash
    fly secrets set VAPI_API_KEY=your_actual_api_key
    ```

4.  **Deploy**
    ```bash
    fly deploy
    ```

### ⚠️ Important Note on Persistence
This application uses a local file `src/lib/db.ts` which reads/writes to `data.json` in the current working directory.
* On **Localhost**, this file persists on your disk.
* On **Fly.io (or any container platform)**, the filesystem is ephemeral. If the server restarts or redeploys, **`data.json` will be reset**, and you will lose the link between your local IDs and Vapi IDs.
* **Recommendation**: For production, consider replacing the JSON DB implementation with a real database (PostgreSQL, MongoDB) or mounting a persistent volume.

---

## 📂 Project Structure

```text
.
├── src
│   ├── index.ts          # Main entry point, API routes
│   └── lib
│       ├── db.ts         # Local JSON database logic
│       └── vapi.ts       # Vapi SDK initialization
├──QP dist/                 # Compiled JavaScript (generated on build)
├── fly.toml              # Fly.io configuration
├── Dockerfile            # Docker configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts