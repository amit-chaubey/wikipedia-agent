from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from langchain_openai import OpenAI
from langchain.agents import initialize_agent
from langchain_community.tools import WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper
import os
from dotenv import load_dotenv
import json
import uuid
import time

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)

# Ensure OpenAI API key is set
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY as an environment variable.")

# Initialize OpenAI model
model = OpenAI(temperature=0, api_key=api_key)

# Initialize Wikipedia API Wrapper
wikipedia_api = WikipediaAPIWrapper()
wikipedia_tool = WikipediaQueryRun(api_wrapper=wikipedia_api)

# Store chat sessions persistently
chat_sessions = {}

# Initialize agent
agent = initialize_agent([wikipedia_tool], model, agent="zero-shot-react-description", handle_parsing_errors=True)

@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, "index.html")

@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory(app.static_folder, path)

@app.route('/api/chat', methods=['POST'])
def chat():
    session_id = request.json.get('session_id', 'default')
    user_input = request.json.get('message', '').strip()

    if session_id not in chat_sessions:
        chat_sessions[session_id] = []

    if user_input:
        try:
            chat_sessions[session_id].append({"role": "user", "content": user_input})
            context = "\n".join([turn["content"] for turn in chat_sessions[session_id][-5:]])
            response = agent.invoke(context)
            
            if isinstance(response, dict) and "output" in response:
                response_text = response["output"]
            elif isinstance(response, str):
                response_text = response
            else:
                response_text = "No output found."

            chat_sessions[session_id].append({"role": "bot", "content": response_text})
            return jsonify({'response': response_text})
        
        except Exception as e:
            return jsonify({'response': f'Error processing request: {str(e)}'}), 500

    return jsonify({'response': 'No input provided'}), 400


@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    session_id = request.args.get('session_id', 'default')
    return jsonify({'history': chat_sessions.get(session_id, [])})

@app.route('/api/chat/sessions', methods=['GET'])
def get_chat_sessions():
    sessions = [{"id": session, "preview": (chat_sessions[session][0]['content'][:30] + '...') if chat_sessions[session] else "Empty"} for session in chat_sessions]
    return jsonify({'sessions': sessions})

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)
