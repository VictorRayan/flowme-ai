'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
// @ts-ignore
import SpriteText from 'three-spritetext';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/navigation';

interface GraphNode {
  id: string;
  name: string;
  group: 'person' | 'note' | 'event' | 'tag';
  val: number;
  color: string;
}

interface GraphLink {
  source: string;
  target: string;
  val: number;
}

interface PersonRecord {
  id: string;
  name: string;
}

interface NoteRecord {
  id: string;
  title?: string | null;
  content_text?: string | null;
  event_id?: string | null;
  event_title?: string | null;
  note_mentions?: Array<{ person_id?: string | null }>;
}

export default function NotesGraphViewer() {
  const [data, setData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const fgRef = useRef<any>(null);

  useEffect(() => {
    async function loadData() {
      // Fetch notes and people
      const [notesRes, peopleRes] = await Promise.all([
        fetch('/api/notes'),
        fetch('/api/people')
      ]);
      const notes = await notesRes.json();
      const people = await peopleRes.json();

      const nodesMap = new Map<string, GraphNode>();
      const links: GraphLink[] = [];

      // Add People Nodes
      people.forEach((p: PersonRecord) => {
        nodesMap.set(`person_${p.id}`, { id: `person_${p.id}`, name: p.name, group: 'person', val: 5, color: '#ff4081' });
      });

      // Add Note Nodes and Extract Edges
      notes.forEach((n: NoteRecord) => {
        nodesMap.set(`note_${n.id}`, { id: `note_${n.id}`, name: n.title || 'Untitled', group: 'note', val: 3, color: '#00e5ff' });

        // Event Links
        if (n.event_id) {
          if (!nodesMap.has(`event_${n.event_id}`)) {
            nodesMap.set(`event_${n.event_id}`, { id: `event_${n.event_id}`, name: n.event_title || n.event_id, group: 'event', val: 4, color: '#ff9100' });
          }
          links.push({ source: `note_${n.id}`, target: `event_${n.event_id}`, val: 1 });
        }

        // Mention Links
        if (n.note_mentions) {
          n.note_mentions.forEach((m) => {
            if (m.person_id) {
              links.push({ source: `note_${n.id}`, target: `person_${m.person_id}`, val: 1 });
            }
          });
        }

        // Tag Links (Extract #tags from content)
        if (n.content_text) {
          const tags = n.content_text.match(/#[a-zA-Z0-9_]+/g);
          if (tags) {
            tags.forEach((tag: string) => {
              const cleanTag = tag.toLowerCase();
              if (!nodesMap.has(`tag_${cleanTag}`)) {
                nodesMap.set(`tag_${cleanTag}`, { id: `tag_${cleanTag}`, name: cleanTag, group: 'tag', val: 2, color: '#00e676' });
              }
              links.push({ source: `note_${n.id}`, target: `tag_${cleanTag}`, val: 1 });
            });
          }
        }
      });

      setData({
        nodes: Array.from(nodesMap.values()),
        links: links
      });
      setLoading(false);
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!loading && fgRef.current) {
      fgRef.current.d3Force('charge').strength(-300);
      fgRef.current.d3Force('link').distance(70);
    }
  }, [loading]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', bgcolor: '#0f172a' }}>
        <CircularProgress sx={{ color: '#00e5ff' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', bgcolor: '#0f172a', overflow: 'hidden' }}>
      {/* HUD Info */}
      <Box sx={{
        position: 'absolute', top: 24, left: 24, zIndex: 10,
        background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)',
        borderRadius: 2, p: 2, border: '1px solid rgba(255,255,255,0.1)', color: '#fff'
      }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => router.push('/app/notes')}
          sx={{ color: '#00e5ff', mb: 2, '&:hover': { color: '#fff' } }}
        >
          Back to Notes
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, textShadow: '0 0 10px rgba(0, 229, 255, 0.5)' }}>
          Neuromorphic Data Map
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
          Your notes visualized dynamically in 3D
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#00e5ff', boxShadow: '0 0 8px #00e5ff' }} />
            <Typography variant="caption">Notes</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff4081', boxShadow: '0 0 8px #ff4081' }} />
            <Typography variant="caption">People</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff9100', boxShadow: '0 0 8px #ff9100' }} />
            <Typography variant="caption">Events</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#00e676', boxShadow: '0 0 8px #00e676' }} />
            <Typography variant="caption">Hashtags</Typography>
          </Box>
        </Box>
      </Box>

      {/* The 3D Map */}
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        nodeLabel="name"
        nodeColor={(node: any) => node.color}
        nodeRelSize={6}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={() => '#ffffff88'}
        linkColor={() => 'rgba(255,255,255,0.2)'}
        backgroundColor="#0f172a"
        nodeThreeObject={(node: any) => {
          const sprite = new SpriteText(node.name || '');
          sprite.color = node.color;
          sprite.textHeight = Math.max(3, node.val * 1.2);
          sprite.fontWeight = 'bold';
          (sprite as SpriteText & { material: { depthWrite: boolean } }).material.depthWrite = false;
          return sprite;
        }}
        onNodeClick={(node: any) => {
          if (node.group === 'note') {
             router.push('/app/notes?highlight=' + node.id.replace('note_', ''));
          }
        }}
      />
    </Box>
  );
}
