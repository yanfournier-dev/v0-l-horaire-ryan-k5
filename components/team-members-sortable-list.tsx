"use client"

import { useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RemoveMemberButton } from "@/components/remove-member-button"
import { parseLocalDate } from "@/lib/date-utils"
import { reorderTeamMembers } from "@/app/actions/teams"
import { GripVertical } from "lucide-react"

interface TeamMember {
  id: number
  first_name: string
  last_name: string
  email: string
  role: string
  phone: string | null
  joined_at: string
  team_rank: number | null
}

interface SortableItemProps {
  member: TeamMember
  teamId: number
  isAdmin: boolean
  getRoleLabel: (role: string) => string
  getRoleBadgeColor: (role: string) => string
}

function SortableItem({ member, teamId, isAdmin, getRoleLabel, getRoleBadgeColor }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: member.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card ref={setNodeRef} style={style} className={isDragging ? "shadow-lg" : ""}>
      <CardContent className="py-2 px-3">
        <div className="flex items-center gap-3 text-sm">
          {/* Grip icon */}
          {isAdmin && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Déplacer"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          {/* Name */}
          <div className="font-medium leading-none min-w-[180px]">
            {member.first_name} {member.last_name}
          </div>

          {/* Role badge */}
          <Badge className={`${getRoleBadgeColor(member.role)} text-xs px-2 py-0 h-5 leading-none shrink-0`}>
            {getRoleLabel(member.role)}
          </Badge>

          {/* Email */}
          <div className="flex-1 min-w-0 text-muted-foreground leading-none truncate">{member.email}</div>

          {/* Phone (optional) */}
          {member.phone && <div className="text-xs text-muted-foreground leading-none shrink-0">📞 {member.phone}</div>}

          {/* Joined date */}
          <div className="text-xs text-muted-foreground leading-none shrink-0 min-w-[100px]">
            Depuis {parseLocalDate(member.joined_at).toLocaleDateString("fr-CA", { year: "numeric", month: "short" })}
          </div>

          {/* Remove button */}
          {isAdmin && (
            <div className="shrink-0">
              <RemoveMemberButton teamId={teamId} userId={member.id} compact />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface TeamMembersSortableListProps {
  members: TeamMember[]
  teamId: number
  isAdmin: boolean
}

export function TeamMembersSortableList({ members: initialMembers, teamId, isAdmin }: TeamMembersSortableListProps) {
  const [members, setMembers] = useState(initialMembers)
  const [isReordering, setIsReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "captain":
        return "Capitaine"
      case "lieutenant":
        return "Lieutenant"
      case "firefighter":
        return "Pompier"
      default:
        return role
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "captain":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      case "lieutenant":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    setIsReordering(true)

    const oldIndex = members.findIndex((m) => m.id === active.id)
    const newIndex = members.findIndex((m) => m.id === over.id)

    const newMembers = arrayMove(members, oldIndex, newIndex)
    setMembers(newMembers)

    // Update ranks in database
    const userIds = newMembers.map((m) => m.id)
    await reorderTeamMembers(teamId, userIds)

    setIsReordering(false)
  }

  if (members.length === 0) {
    return (
      <Card className="col-span-full">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucun membre dans cette équipe</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={members.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {members.map((member) => (
            <SortableItem
              key={member.id}
              member={member}
              teamId={teamId}
              isAdmin={isAdmin}
              getRoleLabel={getRoleLabel}
              getRoleBadgeColor={getRoleBadgeColor}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
