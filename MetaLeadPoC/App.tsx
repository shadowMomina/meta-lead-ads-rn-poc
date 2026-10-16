import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { io } from 'socket.io-client';

type Lead = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

// 10.0.2.2 = the emulator's name for your laptop
const SERVER_URL = 'http://10.0.2.2:3000';

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(SERVER_URL);

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('newLead', (lead: Lead) => {
      setLeads(prev =>
        prev.some(l => l.id === lead.id) ? prev : [lead, ...prev],
      );
    });

    // Cleanup: runs when the screen goes away
    return () => {
      socket.off();
      socket.disconnect();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Leads</Text>
      <Text style={connected ? styles.on : styles.off}>
        {connected ? 'Connected' : 'Disconnected'}
      </Text>
      <FlatList
        data={leads}
        keyExtractor={item => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Waiting for leads...</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text>{item.email}</Text>
            <Text style={styles.time}>{item.createdAt}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 56, paddingHorizontal: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold' },
  on: { color: 'green', marginBottom: 12 },
  off: { color: 'red', marginBottom: 12 },
  empty: { marginTop: 24, color: '#777' },
  card: { padding: 12, marginBottom: 8, borderRadius: 8, backgroundColor: '#f2f2f2' },
  name: { fontWeight: 'bold', fontSize: 16 },
  time: { color: '#777', fontSize: 12, marginTop: 4 },
});