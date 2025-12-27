import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, MapPin, Bell, BarChart3, Users, Shield, Wrench, Construction, TrendingUp, CheckCircle, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from '@/lib/supabase';

// Lazy load the showcase component for better initial load performance
const CompactResolvedShowcase = lazy(() => import('@/components/CompactResolvedShowcase'));

// Real-Time Statistics Component
const RealTimeStats = () => {
  const [stats, setStats] = useState({
    totalIssues: 0,
    resolvedIssues: 0,
    activeCitizens: 0,
    loading: true
  });

  useEffect(() => {
    // Initial fetch
    fetchStats();

    // Only refresh stats every 60 seconds (reduced from 30)
    const interval = setInterval(fetchStats, 60000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const fetchStats = async () => {
    try {
      console.log('🔍 Fetching landing page statistics...');
      
      // Optimize: Fetch all data in parallel instead of sequentially
      const [totalResult, resolvedResult, citizensResult] = await Promise.all([
        supabase.from('issues').select('*', { count: 'exact', head: true }),
        supabase.from('issues').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase.from('issues').select('created_by')
      ]);

      console.log('📊 Database results:', {
        totalResult: totalResult.count,
        totalError: totalResult.error,
        resolvedResult: resolvedResult.count,
        resolvedError: resolvedResult.error,
        citizensData: citizensResult.data?.length,
        citizensError: citizensResult.error
      });

      // Check for errors
      if (totalResult.error) throw totalResult.error;
      if (resolvedResult.error) throw resolvedResult.error;
      if (citizensResult.error) throw citizensResult.error;

      // Count unique citizens
      const uniqueCitizens = new Set(
        citizensResult.data
          ?.map(issue => issue.created_by)
          .filter(id => id !== null && id !== undefined) || []
      ).size;

      const newStats = {
        totalIssues: totalResult.count || 0,
        resolvedIssues: resolvedResult.count || 0,
        activeCitizens: uniqueCitizens || 0,
        loading: false
      };

      console.log('✅ Statistics updated:', newStats);
      setStats(newStats);
    } catch (error: any) {
      console.error('❌ Error fetching statistics:', error);
      // Silently fail and show default stats
      setStats({
        totalIssues: 0,
        resolvedIssues: 0,
        activeCitizens: 0,
        loading: false
      });
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k+`;
    }
    return num.toString();
  };

  return (
    <section className="py-16 px-6 bg-white/10 backdrop-blur-md rounded-t-3xl -mt-12 border-t border-white/20">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Total Issues Reported */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <Card className="shadow-2xl border-none bg-white/20 backdrop-blur-md border border-white/30 overflow-hidden">
              <CardContent className="p-8 text-center relative">
                <div className="absolute top-4 right-4">
                  <FileText className="w-8 h-8 text-yellow-300 opacity-50" />
                </div>
                <div className="mb-4">
                  {stats.loading ? (
                    <div className="animate-pulse">
                      <div className="h-16 bg-white/20 rounded w-32 mx-auto"></div>
                    </div>
                  ) : (
                    <h2 className="text-6xl font-bold text-yellow-300 drop-shadow-lg">
                      {stats.totalIssues === 0 ? '0' : formatNumber(stats.totalIssues)}
                    </h2>
                  )}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Total Issues Reported</h3>
                <p className="text-white/80 text-sm">Community reports submitted</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Issues Resolved to Date */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            <Card className="shadow-2xl border-none bg-white/20 backdrop-blur-md border border-white/30 overflow-hidden">
              <CardContent className="p-8 text-center relative">
                <div className="absolute top-4 right-4">
                  <CheckCircle className="w-8 h-8 text-green-300 opacity-50" />
                </div>
                <div className="mb-4">
                  {stats.loading ? (
                    <div className="animate-pulse">
                      <div className="h-16 bg-white/20 rounded w-32 mx-auto"></div>
                    </div>
                  ) : (
                    <h2 className="text-6xl font-bold text-green-300 drop-shadow-lg">
                      {stats.resolvedIssues === 0 ? '0' : formatNumber(stats.resolvedIssues)}
                    </h2>
                  )}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Issues Resolved to Date</h3>
                <p className="text-white/80 text-sm">Successfully completed</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Active Citizens */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative"
          >
            <Card className="shadow-2xl border-none bg-white/20 backdrop-blur-md border border-white/30 overflow-hidden">
              <CardContent className="p-8 text-center relative">
                <div className="absolute top-4 right-4">
                  <Users className="w-8 h-8 text-blue-300 opacity-50" />
                </div>
                <div className="mb-4">
                  {stats.loading ? (
                    <div className="animate-pulse">
                      <div className="h-16 bg-white/20 rounded w-32 mx-auto"></div>
                    </div>
                  ) : (
                    <h2 className="text-6xl font-bold text-blue-300 drop-shadow-lg">
                      {stats.activeCitizens === 0 ? '0' : formatNumber(stats.activeCitizens)}+
                    </h2>
                  )}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Active Citizens</h3>
                <p className="text-white/80 text-sm">Engaged community members</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Live Update Indicator */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white/90 text-sm">Live Statistics - Updates in Real-Time</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default function Landing() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<'citizen' | 'authority' | null>(null);
  const [showDevModal, setShowDevModal] = useState(false);

  const handleGetStarted = () => {
    // Scroll to the user type selection section
    document.getElementById('user-selection')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCitizenAccess = () => {
    if (currentUser) {
      // User is already logged in, redirect directly
      navigate('/issues');
    } else {
      // User not logged in, show auth modal
      setSelectedUserType('citizen');
      setAuthModalOpen(true);
    }
  };

  const handleAuthorityAccess = () => {
    if (currentUser) {
      // User is already logged in, redirect directly
      navigate('/authority-dashboard');
    } else {
      // User not logged in, show auth modal
      setSelectedUserType('authority');
      setAuthModalOpen(true);
    }
  };

  const handleWorkerAccess = () => {
    // Navigate to official portal login
    navigate('/official/login');
  };

  const handleAuthSuccess = () => {
    // After successful authentication, redirect based on selected user type
    setAuthModalOpen(false);
    if (selectedUserType === 'citizen') {
      navigate('/issues');
    } else if (selectedUserType === 'authority') {
      navigate('/authority-dashboard');
    }
    setSelectedUserType(null);
  };

  const handleAuthClose = () => {
    setAuthModalOpen(false);
    setSelectedUserType(null);
  };

  return (
    <div 
      className="min-h-screen text-white font-sans relative"
      style={{
        backgroundImage: 'url(/image1.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/30"></div>
      
      {/* Content wrapper */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="text-center py-24 px-6">
          <motion.h1 
            initial={{ opacity: 0, y: -30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 1 }} 
            className="text-5xl font-bold mb-4 text-white drop-shadow-lg"
          >
            Nagar Setu: Stronger Villages, Accountable Governance
          </motion.h1>
          <p className="text-lg text-white/90 max-w-3xl mx-auto mb-8 drop-shadow-md">
            A rural-first platform where village problems are reported simply, verified openly, and resolved on time.
          </p>
          <Button 
            onClick={handleGetStarted}
            className="bg-pink-500 hover:bg-pink-600 text-white px-8 py-3 text-lg rounded-full shadow-lg"
          >
            Get Started
          </Button>
        </section>

        {/* Real-Time Statistics Section */}
        <RealTimeStats />

        {/* User Selection Section */}
        <section id="user-selection" className="py-20 px-6 bg-black/30 backdrop-blur-sm">
          <h2 className="text-3xl font-bold text-center mb-12 text-white drop-shadow-lg">Choose Your Access Type</h2>
          <div className="flex flex-col md:flex-row justify-center gap-8 max-w-6xl mx-auto">
          
            {/* Citizen Access */}
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              className="bg-white/20 p-8 rounded-2xl text-center shadow-xl w-full md:w-1/3 backdrop-blur-md border border-white/20"
            >
              <Users className="w-16 h-16 text-pink-400 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-4 text-pink-400">Citizen Access</h3>
              <p className="text-white/90 text-sm mb-6">
                Report civic issues, track progress, and help build a better community. Join thousands of citizens making a difference.
              </p>
              <Button 
                onClick={handleCitizenAccess}
                className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-full w-full"
              >
                Access as Citizen
              </Button>
            </motion.div>

            {/* Authority Access */}
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              className="bg-white/20 p-8 rounded-2xl text-center shadow-xl w-full md:w-1/3 backdrop-blur-md border border-white/20"
            >
              <Shield className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-4 text-blue-400">Authority Access</h3>
              <p className="text-white/90 text-sm mb-6">
                Manage reported issues, coordinate responses, and track resolution progress with advanced analytics and AI insights.
              </p>
              <Button 
                onClick={handleAuthorityAccess}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-full w-full"
              >
                Access as Authority
              </Button>
            </motion.div>

            {/* Worker Access */}
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              className="bg-white/20 p-8 rounded-2xl text-center shadow-xl w-full md:w-1/3 backdrop-blur-md border border-white/20 relative"
            >
              <Wrench className="w-16 h-16 text-orange-400 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-4 text-orange-400">Worker Access</h3>
              <p className="text-white/90 text-sm mb-6">
                Field workers can view assigned tasks, update progress, and complete civic maintenance work efficiently.
              </p>
              <Button 
                onClick={handleWorkerAccess}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-full w-full"
              >
                Access as Worker
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Resolved Issues Showcase - Compact Grid View */}
        <Suspense fallback={
          <div className="py-16 px-6 bg-black/20 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white/80">Loading success stories...</p>
            </div>
          </div>
        }>
          <CompactResolvedShowcase />
        </Suspense>

      {/* CTA Section */}
      <section className="text-center py-20 bg-white/15 backdrop-blur-md border-t border-white/20">
        <h2 className="text-4xl font-bold mb-6 text-white drop-shadow-lg">Build Stronger Villages Together</h2>
        <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto drop-shadow-md">
          Be part of the change. Report village problems, track their resolution, and help build stronger, more accountable rural communities.
        </p>
        <Button 
          onClick={handleGetStarted}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 text-lg rounded-full shadow-xl"
        >
          Get Started Now
        </Button>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-gray-400 bg-gray-950 border-t border-gray-800">
        © 2025 Nagar Setu | Stronger Villages, Accountable Governance
      </footer>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={authModalOpen} 
        onClose={handleAuthClose}
        redirectTo={selectedUserType === 'citizen' ? '/issues' : '/authority-dashboard'}
        userType={selectedUserType || 'citizen'}
      />

      {/* Under Development Modal */}
      <Dialog open={showDevModal} onOpenChange={setShowDevModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Construction className="h-6 w-6 text-orange-500" />
              Under Development
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Wrench className="h-8 w-8 text-orange-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-orange-900 mb-2">Worker Portal Coming Soon!</h3>
                  <p className="text-sm text-orange-800">
                    We're currently building an advanced portal for field workers to manage and complete assigned tasks efficiently.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">Upcoming Features:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>View assigned tasks with GPS navigation</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Upload before/after photos of completed work</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Real-time task updates and notifications</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Performance tracking and achievements</span>
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Stay tuned!</strong> The worker portal will be available soon with powerful tools for municipal field workers.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setShowDevModal(false)}
              >
                Close
              </Button>
              <Button 
                onClick={() => {
                  setShowDevModal(false);
                  handleCitizenAccess();
                }}
                className="bg-pink-500 hover:bg-pink-600"
              >
                Try Citizen Access
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}