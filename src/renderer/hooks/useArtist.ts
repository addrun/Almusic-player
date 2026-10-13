import { useOverlayNavigate } from '@/hooks/useOverlayNavigate';

export const useArtist = () => {
  const { navigate } = useOverlayNavigate();

  /**
   * 跳转到歌手详情页
   * @param id 歌手ID
   */
  const navigateToArtist = (id: number) => {
    navigate(`/artist/detail/${id}`);
  };

  return {
    navigateToArtist
  };
};
