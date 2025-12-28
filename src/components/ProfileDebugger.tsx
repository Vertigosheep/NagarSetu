import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfileDebugger() {
  const { currentUser, userProfile, isNewUser, refreshProfile, loading } = useAuth();

  const handleRefresh = async () => {
    console.log('Manual profile refresh triggered');
    await refreshProfile();
  };

  if (!currentUser) {
    return (
      <Card className="m-4">
        <CardHeader>
          <CardTitle>Profile Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <p>No user logged in</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Profile Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <strong>Loading:</strong> {loading ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>User ID:</strong> {currentUser.id}
        </div>
        <div>
          <strong>User Email:</strong> {currentUser.email}
        </div>
        <div>
          <strong>Is New User:</strong> {isNewUser ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>Profile Exists:</strong> {userProfile ? 'Yes' : 'No'}
        </div>
        {userProfile && (
          <div className="space-y-2">
            <div>
              <strong>Full Name:</strong> {userProfile.full_name || 'Not set'}
            </div>
            <div>
              <strong>User Type:</strong> {userProfile.user_type || 'Not set'}
            </div>
            <div>
              <strong>Onboarding Complete:</strong> {userProfile.is_onboarding_complete ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Age:</strong> {userProfile.age || 'Not set'}
            </div>
            <div>
              <strong>Address:</strong> {userProfile.address || 'Not set'}
            </div>
            <div>
              <strong>City:</strong> {userProfile.city || 'Not set'}
            </div>
          </div>
        )}
        <Button onClick={handleRefresh} className="mt-4">
          Refresh Profile
        </Button>
        <div className="text-xs text-gray-500 mt-4">
          <strong>Raw Profile Data:</strong>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
            {JSON.stringify(userProfile, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}