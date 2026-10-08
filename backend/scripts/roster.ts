/**
 * The real event roster. Players join by user ID (the `id` field).
 * Two entries had no employee code in the source list, so stable IDs were
 * generated for them (marked `generatedId: true`) — share these with those two.
 */
export interface RosterEntry {
  id: string
  name: string
  teamId: 'titans' | 'vibe-tribe' | 'ctrl-alt-defeat'
  generatedId?: boolean
}

export const ROSTER: RosterEntry[] = [
  // Titans
  { id: 'GIPL-RAMESH-N', name: 'Ramesh Namperumal', teamId: 'titans', generatedId: true },
  { id: 'GIPL001', name: 'Kanishkaa', teamId: 'titans' },
  { id: 'GIPL004', name: 'Joni', teamId: 'titans' },
  { id: 'GIPL007', name: 'Eby', teamId: 'titans' },
  { id: 'GIPL011', name: 'Dhanushah', teamId: 'titans' },
  { id: 'GIPL015', name: 'Nagarjuna', teamId: 'titans' },
  { id: 'GIPL018', name: 'Shaik', teamId: 'titans' },
  { id: 'GIPL021', name: 'Babitha', teamId: 'titans' },
  { id: 'GIPL024', name: 'Siva', teamId: 'titans' },
  { id: 'GIPL027', name: 'Issac', teamId: 'titans' },
  { id: 'GIPL031', name: 'Ramesh Patil', teamId: 'titans' },
  { id: 'GIPL034', name: 'Sandeep Gowda', teamId: 'titans' },
  { id: 'GIPL037', name: 'Sravani Bethala', teamId: 'titans' },
  { id: 'GIPL043', name: 'Yashwardhan Singh Chouhan', teamId: 'titans' },

  // Vibe Tribe
  { id: 'GIPL002', name: 'Sanjai', teamId: 'vibe-tribe' },
  { id: 'GIPL005', name: 'Anita', teamId: 'vibe-tribe' },
  { id: 'GIPL008', name: 'Hemalatha', teamId: 'vibe-tribe' },
  { id: 'GIPL013', name: 'Princy', teamId: 'vibe-tribe' },
  { id: 'GIPL016', name: 'Raghul', teamId: 'vibe-tribe' },
  { id: 'GIPL019', name: 'Jeffrey', teamId: 'vibe-tribe' },
  { id: 'GIPL022', name: 'Sneha', teamId: 'vibe-tribe' },
  { id: 'GIPL025', name: 'Sanjeeth', teamId: 'vibe-tribe' },
  { id: 'GIPL028', name: 'Rayappa', teamId: 'vibe-tribe' },
  { id: 'GIPL030', name: 'Rakesh', teamId: 'vibe-tribe' },
  { id: 'GIPL032', name: 'Amruta', teamId: 'vibe-tribe' },
  { id: 'GIPL035', name: 'Gnana sree', teamId: 'vibe-tribe' },
  { id: 'GIPL038', name: 'Kailashnath Sharma', teamId: 'vibe-tribe' },
  { id: 'GIPL044', name: 'Kavya B', teamId: 'vibe-tribe' },

  // Ctrl Alt Defeat
  { id: 'GIPL-RAM', name: 'Ram', teamId: 'ctrl-alt-defeat', generatedId: true },
  { id: 'GIPL003', name: 'Malathy', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL006', name: 'Dhanuja', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL009', name: 'Sharmili', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL014', name: 'Diyanesh', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL017', name: 'Salini', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL020', name: 'Giri', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL023', name: 'Aditya', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL026', name: 'Kowsalya', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL029', name: 'Himanshu', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL033', name: 'Ram Teja', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL036', name: 'Mercy Flavia', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL039', name: 'Srinath Chagaleti', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL040', name: 'Pavan Shyam', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL041', name: 'Saran', teamId: 'ctrl-alt-defeat' },
  { id: 'GIPL042', name: 'Harshavarthan', teamId: 'ctrl-alt-defeat' },
]
