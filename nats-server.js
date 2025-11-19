/**
 * Simple NATS Server for Development
 * Pure JavaScript - No external binaries needed!
 */

const net = require('net');
const EventEmitter = require('events');

class SimpleNATSServer extends EventEmitter {
  constructor(port = 4222) {
    super();
    this.port = port;
    this.clients = new Map();
    this.subscriptions = new Map();
    this.server = null;
    this.clientId = 0;
    this.pendingPubs = new Map(); // Track pending PUB commands
  }

  start() {
    this.server = net.createServer((socket) => {
      const clientId = ++this.clientId;
      this.clients.set(clientId, socket);
      
      console.log(`[NATS] Client connected: ${clientId}`);
      
      // Send INFO message
      const info = {
        server_id: 'simple-nats-server',
        version: '1.0.0',
        proto: 1,
        host: '127.0.0.1',
        port: this.port,
        max_payload: 1048576,
      };
      socket.write(`INFO ${JSON.stringify(info)}\r\n`);

      let buffer = '';
      let pendingPub = null; // Track current PUB command being processed
      
      socket.on('data', (data) => {
        buffer += data.toString();
        
        // Handle pending PUB payload
        if (pendingPub) {
          const { subject, payloadSize } = pendingPub;
          const totalNeeded = payloadSize + 2; // +2 for \r\n
          
          if (buffer.length >= totalNeeded) {
            const payload = buffer.substring(0, payloadSize);
            buffer = buffer.substring(totalNeeded);
            
            // Deliver to subscribers
            this.deliverMessage(subject, payload);
            
            pendingPub = null;
          }
        }
        
        // Process complete messages
        while (buffer.length > 0) {
          const idx = buffer.indexOf('\r\n');
          if (idx === -1) break;
          
          const line = buffer.substring(0, idx);
          buffer = buffer.substring(idx + 2);
          
          const result = this.handleMessage(clientId, socket, line);
          if (result && result.type === 'PUB') {
            pendingPub = result;
            break; // Wait for payload
          }
        }
      });

      socket.on('close', () => {
        console.log(`[NATS] Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        
        // Remove subscriptions for this client
        for (const [subject, subs] of this.subscriptions.entries()) {
          const filtered = subs.filter(s => s.clientId !== clientId);
          if (filtered.length === 0) {
            this.subscriptions.delete(subject);
          } else {
            this.subscriptions.set(subject, filtered);
          }
        }
      });

      socket.on('error', (err) => {
        console.error(`[NATS] Client error: ${err.message}`);
      });
    });

    this.server.listen(this.port, () => {
      console.log(`\n✅ NATS Server listening on port ${this.port}`);
      console.log(`   URL: nats://localhost:${this.port}\n`);
    });

    this.server.on('error', (err) => {
      console.error(`[NATS] Server error: ${err.message}`);
    });
  }

  handleMessage(clientId, socket, line) {
    const parts = line.split(' ');
    const cmd = parts[0];

    switch (cmd) {
      case 'CONNECT':
        // Client connection
        socket.write('+OK\r\n');
        return null;

      case 'PING':
        socket.write('PONG\r\n');
        return null;

      case 'SUB':
        // SUB <subject> [queue] <sid>
        const subject = parts[1];
        const sid = parts[parts.length - 1];
        
        if (!this.subscriptions.has(subject)) {
          this.subscriptions.set(subject, []);
        }
        this.subscriptions.get(subject).push({ clientId, socket, sid });
        
        console.log(`[NATS] Client ${clientId} subscribed to: ${subject}`);
        socket.write('+OK\r\n');
        return null;

      case 'UNSUB':
        // UNSUB <sid> [max_msgs]
        const unsubSid = parts[1];
        for (const [subj, subs] of this.subscriptions.entries()) {
          const filtered = subs.filter(s => !(s.clientId === clientId && s.sid === unsubSid));
          if (filtered.length === 0) {
            this.subscriptions.delete(subj);
          } else {
            this.subscriptions.set(subj, filtered);
          }
        }
        socket.write('+OK\r\n');
        return null;

      case 'PUB':
        // PUB <subject> [reply-to] <#bytes>
        // Format: PUB <subject> [reply-to] <#bytes>\r\n<payload>\r\n
        const pubParts = parts.slice(1);
        let pubSubject, replyTo, payloadSize;
        
        if (pubParts.length === 2) {
          // PUB <subject> <#bytes>
          pubSubject = pubParts[0];
          payloadSize = parseInt(pubParts[1], 10);
        } else if (pubParts.length === 3) {
          // PUB <subject> <reply-to> <#bytes>
          pubSubject = pubParts[0];
          replyTo = pubParts[1];
          payloadSize = parseInt(pubParts[2], 10);
        } else {
          console.error(`[NATS] Invalid PUB format: ${line}`);
          return null;
        }
        
        console.log(`[NATS] Client ${clientId} publishing to: ${pubSubject} (${payloadSize} bytes)`);
        
        // Return PUB info so we can read payload
        return { type: 'PUB', subject: pubSubject, replyTo, payloadSize };

      default:
        // Unknown command
        console.warn(`[NATS] Unknown command: ${cmd}`);
        return null;
    }
  }

  deliverMessage(subject, payload) {
    // Find all subscribers for this subject
    const subscribers = this.subscriptions.get(subject) || [];
    
    if (subscribers.length === 0) {
      console.log(`[NATS] No subscribers for: ${subject}`);
      return;
    }
    
    console.log(`[NATS] Delivering message to ${subscribers.length} subscriber(s) of: ${subject}`);
    
    // Deliver to all subscribers
    subscribers.forEach(({ socket, sid }) => {
      try {
        // NATS message format: MSG <subject> <sid> [reply-to] <#bytes>\r\n<payload>\r\n
        const msgHeader = `MSG ${subject} ${sid} ${payload.length}\r\n`;
        socket.write(msgHeader + payload + '\r\n');
      } catch (err) {
        console.error(`[NATS] Error delivering to subscriber: ${err.message}`);
      }
    });
  }

  stop() {
    if (this.server) {
      this.clients.forEach(client => client.destroy());
      this.server.close(() => {
        console.log('[NATS] Server stopped');
      });
    }
  }
}

// Start server if run directly
if (require.main === module) {
  const port = process.env.NATS_PORT || 4222;
  const server = new SimpleNATSServer(port);
  server.start();

  process.on('SIGINT', () => {
    console.log('\n[NATS] Shutting down...');
    server.stop();
    process.exit(0);
  });
}

module.exports = SimpleNATSServer;

