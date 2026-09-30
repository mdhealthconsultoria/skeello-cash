import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Camera } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Avatar } from '../ui/Avatar'
import { usePeople } from '../../hooks/usePeople'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Person } from '../../types/database'

export function AddPersonModal({
  open,
  onClose,
  onCreated,
  editPerson,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (person: Person) => void
  editPerson?: Person | null
}) {
  const { user } = useAuth()
  const { createPerson, updatePerson } = usePeople()
  const [name, setName] = useState(editPerson?.name ?? '')
  const [nickname, setNickname] = useState(editPerson?.nickname ?? '')
  const [phone, setPhone] = useState(editPerson?.phone ?? '')
  const [email, setEmail] = useState(editPerson?.email ?? '')
  const [notes, setNotes] = useState(editPerson?.notes ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(editPerson?.photo_url ?? null)
  const [loading, setLoading] = useState(false)

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Informe o nome da pessoa.')
      return
    }
    setLoading(true)

    let photoUrl = editPerson?.photo_url ?? null
    if (photoFile && user) {
      const ext = photoFile.name.split('.').pop()
      const path = `${user.id}/people/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, photoFile, { upsert: true })
      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        photoUrl = data.publicUrl
      }
    }

    const payload = { name, nickname: nickname || null, phone: phone || null, email: email || null, notes: notes || null, photo_url: photoUrl }

    const result = editPerson
      ? await updatePerson(editPerson.id, payload)
      : await createPerson(payload)

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(editPerson ? 'Pessoa atualizada!' : 'Pessoa adicionada!')
    onCreated?.(result.data as Person)
    onClose()
    if (!editPerson) {
      setName('')
      setNickname('')
      setPhone('')
      setEmail('')
      setNotes('')
      setPhotoFile(null)
      setPhotoPreview(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editPerson ? 'Editar pessoa' : 'Nova pessoa'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-center">
          <label className="relative cursor-pointer">
            <Avatar src={photoPreview} name={name || '?'} size="xl" />
            <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 flex items-center justify-center border-2 border-white dark:border-ink-900">
              <Camera size={13} />
            </span>
            <input type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
          </label>
        </div>

        <div>
          <label className="label">Nome *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Nome completo" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Apelido</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="input" placeholder="Opcional" />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="(00) 00000-0000" />
          </div>
        </div>
        <div>
          <label className="label">E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="Opcional" />
        </div>
        <div>
          <label className="label">Observações</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input resize-none" rows={2} />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? 'Salvando...' : editPerson ? 'Salvar alterações' : 'Adicionar pessoa'}
        </button>
      </form>
    </Modal>
  )
}
