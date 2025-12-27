import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEventById, EventData } from '@/services/supabaseService';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getEventById(id)
      .then((data) => {
        if (data) setEvent(data);
        else setError('Event not found.');
      })
      .catch((err) => setError(err.message || 'Failed to load event.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="pt-32 pb-20 px-4 md:px-6 container mx-auto">
          <div className="max-w-2xl mx-auto">
            <p className="text-xl text-muted-foreground mb-12">Loading event...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="pt-32 pb-20 px-4 md:px-6 container mx-auto">
          <div className="max-w-2xl mx-auto">
            <p className="text-xl text-destructive mb-12">{error}</p>
            <Button onClick={() => navigate('/events')}>Back to Events</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-32 pb-20 px-4 md:px-6 container mx-auto">
        <div className="max-w-2xl mx-auto">
          <Button variant="outline" className="mb-6" onClick={() => navigate('/events')}>
            Back to Events
          </Button>
          <h1 className="text-3xl font-semibold mb-4">{event.title}</h1>
          <div className="mb-4 text-muted-foreground">
            <span className="mr-4">{event.date}</span>
            <span>{event.time}</span>
          </div>
          <div className="mb-4">
            <span className="font-medium">Location:</span> {event.location}
          </div>
          <div className="mb-4">
            <span className="font-medium">Categories:</span> {event.categories && event.categories.join(', ')}
          </div>
          <div className="mb-4">
            <span className="font-medium">Status:</span> {event.status}
          </div>
          <div className="mb-4">
            <span className="font-medium">Volunteers:</span> {event.volunteersCount || 0}
          </div>
          <div className="mb-8">
            <span className="font-medium">Description:</span>
            <div className="prose prose-sm max-w-none mt-2">{event.description}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetail; 