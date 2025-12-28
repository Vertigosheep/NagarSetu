// PROTOTYPE VOTING SYSTEM UTILITIES
// This is a temporary client-side voting system for demonstration purposes

export const clearPrototypeVotes = () => {
  localStorage.removeItem('userUpvotes');
  localStorage.removeItem('issueVotes');
  console.log('🗳️ PROTOTYPE: Cleared all vote data');
};

export const getPrototypeVoteStats = () => {
  const userUpvotes = JSON.parse(localStorage.getItem('userUpvotes') || '[]');
  const issueVotes = JSON.parse(localStorage.getItem('issueVotes') || '{}');
  
  const stats = {
    totalUserVotes: userUpvotes.length,
    totalIssuesWithVotes: Object.keys(issueVotes).length,
    totalVotesCast: Object.values(issueVotes).reduce((sum: number, count: any) => sum + count, 0),
    userVotedIssues: userUpvotes,
    issueVoteCounts: issueVotes
  };
  
  console.log('🗳️ PROTOTYPE: Vote Statistics', stats);
  return stats;
};

export const addDemoVotes = (issueIds: string[]) => {
  const issueVotes = JSON.parse(localStorage.getItem('issueVotes') || '{}');
  
  issueIds.forEach((id, index) => {
    if (!issueVotes[id]) {
      // Add random vote counts between 0-15 for demo
      issueVotes[id] = Math.floor(Math.random() * 16);
    }
  });
  
  localStorage.setItem('issueVotes', JSON.stringify(issueVotes));
  console.log('🗳️ PROTOTYPE: Added demo votes for', issueIds.length, 'issues');
  return issueVotes;
};

// Add to window for easy debugging in console
if (typeof window !== 'undefined') {
  (window as any).prototypeVoting = {
    clear: clearPrototypeVotes,
    stats: getPrototypeVoteStats,
    addDemo: addDemoVotes
  };
  
  console.log('🗳️ PROTOTYPE: Voting utilities available at window.prototypeVoting');
  console.log('  - window.prototypeVoting.clear() - Clear all votes');
  console.log('  - window.prototypeVoting.stats() - Show vote statistics');
  console.log('  - window.prototypeVoting.addDemo(issueIds) - Add demo votes');
}