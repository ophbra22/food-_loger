import { Directory, File, Paths } from 'expo-file-system';
import { clearPrivateFiles } from '../private-files';
jest.mock('expo-file-system', () => ({
  File: class { name: string; delete = jest.fn(); constructor(name: string) { this.name = name; } },
  Directory: class { name: string; delete = jest.fn(); constructor(name: string) { this.name = name; } },
  Paths: { cache: { list: jest.fn() } },
}));
it('erases private exports and photo copies while preserving unrelated app assets', () => {
  const privateItems = [new File('foodlogger-2026-10-11.csv'), new File('biteflow-2026-10-11.csv'),
    new File('12345678-1234-1234-1234-123456789012.jpg'),
    new Directory('ImagePicker'), new Directory('ImageManipulator')];
  const unrelated = [new File('font.ttf'), new Directory('expo')];
  jest.mocked(Paths.cache.list).mockReturnValue([...privateItems, ...unrelated]);
  clearPrivateFiles();
  privateItems.forEach(item => expect(item.delete).toHaveBeenCalled());
  unrelated.forEach(item => expect(item.delete).not.toHaveBeenCalled());
});
