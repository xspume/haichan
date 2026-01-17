import { UserCog, Trash2, Shield } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'

interface AdminUsersProps {
  allUsers: any[]
  setDeleteDialog: (dialog: any) => void
}

export function AdminUsers({ allUsers, setDeleteDialog }: AdminUsersProps) {
  return (
    <Card className="border-4 border-foreground">
      <CardHeader className="bg-card text-card-foreground border-b-4 border-foreground">
        <CardTitle className="font-mono text-sm">User Management</CardTitle>
        <CardDescription className="font-mono text-xs text-muted-foreground mt-1">
          Monitor and manage registered users
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="border-2 border-foreground overflow-hidden">
          <table className="w-full font-mono text-xs">
            <thead className="bg-foreground text-background">
              <tr>
                <th className="p-3 text-left">Username</th>
                <th className="p-3 text-left">ID</th>
                <th className="p-3 text-left">PoW</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-foreground">
              {allUsers.map((user) => (
                <tr key={user.id} className="hover:bg-muted transition-colors">
                  <td className="p-3 font-bold">{user.username}</td>
                  <td className="p-3 text-muted-foreground truncate max-w-[100px]">{user.id}</td>
                  <td className="p-3">{(Number(user.totalPowPoints) || 0).toLocaleString()}</td>
                  <td className="p-3">
                    {Number(user.isAdmin) > 0 ? (
                      <Badge className="bg-foreground text-background font-mono text-[10px]">Admin</Badge>
                    ) : (
                      <Badge variant="outline" className="font-mono text-[10px]">User</Badge>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={user.username === 'jcb'}
                      onClick={() => setDeleteDialog({ open: true, type: 'user', id: user.id, name: user.username })}
                      className="h-8 w-8 text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
