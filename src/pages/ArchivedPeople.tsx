import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArchiveRestore } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePeople } from '../hooks/usePeople'
import { Avatar } from '../components/ui/Avatar'
import { EmptyState } from '../components/ui/EmptyState'

export default function ArchivedPeople() {
  const navigate = useNavigate()
  const { people, loading, archivePerson } = usePeople(true)
  const archived = people.filter((p) => p.archived)

  async function unarchive(id: string) {
    const { error } = await archivePerson(id, false)
    if (error) toast.error(error)
    else toast.success('Pessoa restaurada!')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-ink-400">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Arquivados</h1>
      </div>

      {!loading && archived.length === 0 ? (
        <EmptyState
          icon={<ArchiveRestore size={22} />}
          title="Nenhuma pessoa arquivada"
          description="Pessoas arquivadas aparecem aqui e podem ser restauradas a qualquer momento."
        />
      ) : (
        <div className="space-y-2.5">
          {archived.map((p) => (
            <div key={p.id} className="card p-4 flex items-center gap-3">
              <Avatar src={p.photo_url} name={p.name} />
              <p className="flex-1 font-medium text-ink-900 dark:text-ink-50">{p.name}</p>
              <button onClick={() => unarchive(p.id)} className="btn-secondary text-xs px-3 py-1.5">
                Restaurar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
